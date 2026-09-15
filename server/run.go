package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	maxPlaintext = 32
	maxOutput    = 65536
	runTimeout   = 3 * time.Second
	maxBody      = 1 << 20
)

type RunRequest struct {
	Part         string `json:"part"`
	Variant      string `json:"variant"`
	Plaintext    string `json:"plaintext"`
	KeyHex       string `json:"keyHex"`
	Passphrase   string `json:"passphrase"`
	IVHex        string `json:"ivHex"`
	KeyBits      int    `json:"keyBits"`
	TDESKeys     int    `json:"tdesKeys"`
	Direction    string `json:"direction"`
	InputB64     string `json:"inputB64"`
	PublicPEM    string `json:"publicPem"`
	PrivatePEM   string `json:"privatePem"`
	SignatureB64 string `json:"signatureB64"`
}

type RunResponse struct {
	Argv       []string    `json:"argv"`
	Stdout     string      `json:"stdout"`
	Stderr     string      `json:"stderr"`
	Error      string      `json:"error,omitempty"`
	CertFields []CertField `json:"certFields,omitempty"`
}

type CertField struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

var allowedParts = map[string]bool{
	"foundations": true,
	"rc4":         true,
	"des":         true,
	"tdes":        true,
	"aes":         true,
	"handshake":   true,
	"rsa":         true,
	"sign":        true,
	"trust":       true,
}

func handleRun(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)

	var req RunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(RunResponse{Error: "invalid json: " + err.Error()})
		return
	}

	if !allowedParts[req.Part] {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(RunResponse{Error: "unknown part"})
		return
	}
	if len(req.Plaintext) > maxPlaintext {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(RunResponse{Error: fmt.Sprintf("plaintext longer than %d characters", maxPlaintext)})
		return
	}

	resp := runOpenSSL(r.Context(), req)
	_ = json.NewEncoder(w).Encode(resp)
}

func runOpenSSL(ctx context.Context, req RunRequest) RunResponse {
	bin, err := exec.LookPath("openssl")
	if err != nil {
		return RunResponse{Error: "openssl not found"}
	}

	plan, err := buildPlan(req)
	if plan.cleanup != nil {
		defer plan.cleanup()
	}
	if err != nil {
		return RunResponse{Error: plan.scrub(err.Error())}
	}
	args := plan.args

	ctx, cancel := context.WithTimeout(ctx, runTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Dir = plan.dir
	if len(plan.stdin) > 0 {
		cmd.Stdin = bytes.NewReader(plan.stdin)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	runErr := cmd.Run()
	outBytes := stdout.Bytes()
	out := string(outBytes)
	var certFields []CertField
	if req.Part == "trust" && req.Variant == "s_client-google" && runErr == nil {
		leaf, leafErr := extractLeafPEM(out)
		if leafErr != nil {
			runErr = leafErr
		} else {
			out = leaf
			certFields, err = inspectCertificate(leaf)
			if err != nil {
				runErr = err
			}
		}
	}
	// DH shared secret is raw binary — show hex so the Real world strip stays readable JSON/text.
	if req.Part == "handshake" && req.Variant == "dh-derive" && runErr == nil && len(outBytes) > 0 {
		out = hex.EncodeToString(outBytes) + "\n"
	}
	errOut := stderr.String()
	// Students read this text: never let the container's temp paths through.
	out = plan.scrub(out)
	errOut = plan.scrub(errOut)
	trunc := ""
	if len(out)+len(errOut) > maxOutput {
		// Prefer keeping stderr if we must truncate.
		if len(errOut) > maxOutput {
			errOut = errOut[:maxOutput]
			out = ""
		} else {
			remain := maxOutput - len(errOut)
			if len(out) > remain {
				out = out[:remain]
			}
		}
		trunc = "output truncated"
	}

	resp := RunResponse{
		Argv:       append([]string{"openssl"}, args...),
		Stdout:     out,
		Stderr:     errOut,
		Error:      trunc,
		CertFields: certFields,
	}
	if runErr != nil && trunc == "" {
		// openssl non-zero exit is useful classroom signal; surface via stderr.
		if errors.Is(runErr, context.DeadlineExceeded) || ctx.Err() == context.DeadlineExceeded {
			resp.Error = "timeout"
		} else if resp.Stderr == "" {
			resp.Error = runErr.Error()
		}
	}
	return resp
}

// runPlan is one classroom command: the argv, optional stdin, and the private directory
// openssl runs in. Every argv entry is relative to dir, so the command a student copies and
// the paths openssl echoes back ("Using configuration from openssl.cnf", "leaf.pem: OK")
// are the same classroom filenames — never a host temp path.
type runPlan struct {
	args    []string
	stdin   []byte
	dir     string
	cleanup func()
}

// scrub removes the workspace path from anything a student reads, in case openssl resolves
// a relative argument back to an absolute one.
func (p runPlan) scrub(text string) string {
	if p.dir == "" || !strings.Contains(text, "/") {
		return text
	}
	prefixes := []string{p.dir}
	if resolved, err := filepath.EvalSymlinks(p.dir); err == nil && resolved != p.dir {
		prefixes = append(prefixes, resolved)
	}
	for _, prefix := range prefixes {
		text = strings.ReplaceAll(text, prefix+string(filepath.Separator), "")
		text = strings.ReplaceAll(text, prefix, ".")
	}
	return text
}

func buildPlan(req RunRequest) (runPlan, error) {
	switch req.Part {
	case "foundations":
		return foundationsArgv(req)
	case "rc4":
		return rc4Argv(req)
	case "des":
		return desArgv(req)
	case "tdes":
		return tdesArgv(req)
	case "aes":
		return aesArgv(req)
	case "handshake":
		return handshakeArgv(req)
	case "sign":
		return signArgv(req)
	case "trust":
		return trustArgv(req)
	default:
		return runPlan{}, fmt.Errorf("part %q not implemented yet", req.Part)
	}
}

// Fixed teaching DH params (512-bit) PEM — embedded so Run never hits the network.
const cannedDHParamPEM = `-----BEGIN DH PARAMETERS-----
MEkCQQDHgrJSEucbzwG3iVEwJwmNb31HsPOGwL2BwxkgWmNlhwOBVPIWIbI2v31g
6SJd2uF5oXSwrjKtSuWldcS9ZlDPAgECAgF9
-----END DH PARAMETERS-----
`

// cannedGoogleLeafPEM must stay in sync with web/src/fixtures/google-leaf.pem
const cannedGoogleLeafPEM = `-----BEGIN CERTIFICATE-----
MIIEMjCCAxqgAwIBAgIQUkvcWj00f1gSQHGaLyYhajANBgkqhkiG9w0BAQsFADA7
MQswCQYDVQQGEwJVUzEeMBwGA1UEChMVR29vZ2xlIFRydXN0IFNlcnZpY2VzMQww
CgYDVQQDEwNXUjIwHhcNMjYwODEwMDgzOTQ5WhcNMjYxMTAyMDgzOTQ4WjAZMRcw
FQYDVQQDEw53d3cuZ29vZ2xlLmNvbTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IA
BHFCBgPlIJ09m2GYxJKIJQrbBIldDXzUnUNiY2hQ/Y/sDxMsMkjg13xYvmo2kJE7
Ivj3Q1lwJaJ0TPwkoqdlgdOjggIdMIICGTAOBgNVHQ8BAf8EBAMCB4AwEwYDVR0l
BAwwCgYIKwYBBQUHAwEwDAYDVR0TAQH/BAIwADAdBgNVHQ4EFgQU/J8OowMnfjPJ
dHv+qlRwzbfwq8YwHwYDVR0jBBgwFoAU3hse7XkV1D43JMMhu+w0OW1CsjAwNQYI
KwYBBQUHAQEEKTAnMCUGCCsGAQUFBzAChhlodHRwOi8vaS5wa2kuZ29vZy93cjIu
Y3J0MBkGA1UdEQQSMBCCDnd3dy5nb29nbGUuY29tMBMGA1UdIAQMMAowCAYGZ4EM
AQIBMDYGA1UdHwQvMC0wK6ApoCeGJWh0dHA6Ly9jLnBraS5nb29nL3dyMi85VVZi
TjB3NUU2WS5jcmwwggEDBgorBgEEAdZ5AgQCBIH0BIHxAO8AdQDXbX0Q0af1d8LH
6V/XAL/5gskzWmXh0LMBcxfAyMVpdwAAAZ/rCvETAAAEAwBGMEQCIHdeVOEwHt5e
nZjddxfc4F6rTdQ/GrXOplX3kqU4q7i9AiB4fJgYAphY9MPCUIE1gCBZ0wHPm3cR
4LE45NTm8C+IOwB2AJROQ4f67MHvgfMZJCaoGGUBx9NfOAIBP3JnfVU3LhnYAAAB
n+sK8SIAAAQDAEcwRQIgZAqiaPEX/xqsReFd1M20+6XLfVps49hMpWCFfE3sQ+4C
IQCIaP2cSoK+3jqcb1tV6CF6hEF92qMZeciaU5pvsRhWoTANBgkqhkiG9w0BAQsF
AAOCAQEAUC+eE1aVrJHHvEcX0ZXhTdS3Kal6Z8oI6zJFoTSymZY3EAnTvgG0hCCQ
mlL+RSS0H2UtvnpMIuttvVjJN1AaJUUKV/Cu5ur+hJMLT1pMO1Kv0J+uwlmgzjWJ
ZcY+isUMb1SiuJl62vdzA6kN03iQLWKa/D0UlNURJcdSTzWPg741NOcIMiVzJTVC
8MAEHUpzikHFQPmiRcwFklmPk9xV7Sx7NlF2BKjSZX9bTwpOhIwKHBQNOFOTuWRJ
hZi9Vr5WFHXBHPLIHpDqsfBTuBXnOkmYtqLFkHkNH0DxPcAfFAhnLpqSOdEhee5s
iz/xWaz/xHNo7HJllHoVBomBhirakQ==
-----END CERTIFICATE-----
`

func trustArgv(req RunRequest) (runPlan, error) {
	switch req.Variant {
	case "x509-text":
		ws, err := newWorkspace(map[string]string{"google-leaf.pem": cannedGoogleLeafPEM})
		if err != nil {
			return runPlan{}, err
		}
		return ws.plan("x509", "-in", "google-leaf.pem", "-text", "-noout"), nil
	case "s_client-google":
		return runPlan{args: []string{
			"s_client",
			"-connect", "www.google.com:443",
			"-servername", "www.google.com",
			"-showcerts",
		}}, nil
	case "hmac-sha256":
		key := strings.TrimSpace(req.Passphrase)
		if key == "" {
			return runPlan{}, fmt.Errorf("passphrase (HMAC key) required")
		}
		// openssl dgst -sha256 -hmac <key>  (message on stdin)
		return runPlan{args: []string{"dgst", "-sha256", "-hmac", key}, stdin: []byte(req.Plaintext)}, nil
	case "toy-ca-gen", "toy-csr-subject", "toy-ca-sign", "toy-chain-verify", "toy-leaf-fields":
		return toyCAArgv(req.Variant)
	case "revoke-setup", "revoke-verify-before", "revoke-leaf", "revoke-show-crl", "revoke-verify-after":
		return revocationArgv(req.Variant)
	default:
		return runPlan{}, fmt.Errorf("unknown trust variant %q", req.Variant)
	}
}

// Part 7.1 Real world: a classroom toy CA. Every Run is independent, so each variant
// rebuilds exactly the files its step needs in a fresh temp dir, then runs the one
// command the student sees. Subjects and sizes are fixed — nothing comes from the browser.
const (
	toyCASubject   = "/CN=Crypto Visualizer Classroom CA"
	toyLeafSubject = "/CN=alice.example"
	toyCADays      = "365"
	toyKeySpec     = "rsa:2048"
	toyKeyBits     = "2048"
)

// workspace is the private directory a Run happens in. Files are created with classroom
// names (ca.pem, leaf.pem, openssl.cnf) and openssl is invoked with the directory as its
// working directory, so no host path ever reaches the browser.
type workspace struct {
	dir     string
	cleanup func()
}

func newWorkspace(files map[string]string) (*workspace, error) {
	dir, err := os.MkdirTemp("", "cv-run-*")
	if err != nil {
		return nil, err
	}
	ws := &workspace{dir: dir, cleanup: func() { _ = os.RemoveAll(dir) }}
	if err := os.Chmod(dir, 0o700); err != nil {
		ws.cleanup()
		return nil, err
	}
	for name, content := range files {
		if err := ws.write(name, content); err != nil {
			ws.cleanup()
			return nil, err
		}
	}
	return ws, nil
}

func (w *workspace) write(name, content string) error {
	return os.WriteFile(filepath.Join(w.dir, name), []byte(content), 0o600)
}

func (w *workspace) path(name string) string { return filepath.Join(w.dir, name) }

func (w *workspace) plan(args ...string) runPlan {
	return runPlan{args: args, dir: w.dir, cleanup: w.cleanup}
}

// fail abandons the workspace and reports why the Run could not be prepared.
func (w *workspace) fail(err error) (runPlan, error) {
	w.cleanup()
	return runPlan{}, err
}

// prep runs a fixed openssl command whose output the student never sees — it only
// materializes files an earlier classroom step would have left in the directory.
func (w *workspace) prep(args ...string) error {
	bin, err := exec.LookPath("openssl")
	if err != nil {
		return fmt.Errorf("openssl not found")
	}
	ctx, cancel := context.WithTimeout(context.Background(), runTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Dir = w.dir
	var stderr bytes.Buffer
	cmd.Stdout = io.Discard
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("prepare %s: %s", args[0], msg)
	}
	return nil
}

func toyCAArgv(variant string) (runPlan, error) {
	ws, err := newWorkspace(nil)
	if err != nil {
		return runPlan{}, err
	}

	switch variant {
	case "toy-ca-gen":
		// Self-signed CA cert goes to stdout; only the CA private key lands on disk.
		return ws.plan(
			"req", "-x509",
			"-newkey", toyKeySpec,
			"-noenc",
			"-keyout", "ca.key",
			"-days", toyCADays,
			"-subj", toyCASubject,
		), nil

	case "toy-csr-subject":
		if err := toyCAMakeCSR(ws); err != nil {
			return ws.fail(err)
		}
		return ws.plan("req", "-in", "leaf.csr", "-noout", "-subject", "-verify"), nil

	case "toy-ca-sign":
		if err := toyCAMakeCA(ws); err != nil {
			return ws.fail(err)
		}
		if err := toyCAMakeCSR(ws); err != nil {
			return ws.fail(err)
		}
		// Signed leaf cert goes to stdout.
		return ws.plan(
			"x509", "-req",
			"-in", "leaf.csr",
			"-CA", "ca.crt",
			"-CAkey", "ca.key",
			"-CAcreateserial",
			"-days", toyCADays,
			"-sha256",
		), nil

	case "toy-chain-verify", "toy-leaf-fields":
		if err := toyCAMakeCA(ws); err != nil {
			return ws.fail(err)
		}
		if err := toyCAMakeCSR(ws); err != nil {
			return ws.fail(err)
		}
		if err := toyCASignLeaf(ws); err != nil {
			return ws.fail(err)
		}
		if variant == "toy-leaf-fields" {
			return ws.plan(
				"x509", "-in", "leaf.crt",
				"-noout", "-subject", "-issuer", "-dates", "-serial",
			), nil
		}
		return ws.plan("verify", "-CAfile", "ca.crt", "leaf.crt"), nil
	}

	return ws.fail(fmt.Errorf("unknown toy CA variant %q", variant))
}

// toyCAMakeCA writes ca.key + ca.crt (self-signed root).
func toyCAMakeCA(ws *workspace) error {
	return ws.prep(
		"req", "-x509",
		"-newkey", toyKeySpec,
		"-noenc",
		"-keyout", "ca.key",
		"-days", toyCADays,
		"-subj", toyCASubject,
		"-out", "ca.crt",
	)
}

// toyCAMakeCSR writes leaf.key + leaf.csr carrying the claimed name.
func toyCAMakeCSR(ws *workspace) error {
	if err := ws.prep("genrsa", "-out", "leaf.key", toyKeyBits); err != nil {
		return err
	}
	return ws.prep(
		"req", "-new",
		"-key", "leaf.key",
		"-subj", toyLeafSubject,
		"-out", "leaf.csr",
	)
}

// toyCASignLeaf writes leaf.crt signed by the toy CA.
func toyCASignLeaf(ws *workspace) error {
	return ws.prep(
		"x509", "-req",
		"-in", "leaf.csr",
		"-CA", "ca.crt",
		"-CAkey", "ca.key",
		"-CAcreateserial",
		"-days", toyCADays,
		"-sha256",
		"-out", "leaf.crt",
	)
}

// Part 7.3: every Run rebuilds the toy CA database from scratch, so the leaf always gets
// serial 1000 and the revoke / CRL / verify steps still tell one consistent story.
func revocationArgv(variant string) (runPlan, error) {
	ws, err := newWorkspace(map[string]string{
		"openssl.cnf": revocationCAConfig,
		"index.txt":   "",
		"serial":      "1000\n",
		"crlnumber":   "1000\n",
	})
	if err != nil {
		return runPlan{}, err
	}
	if err := os.Mkdir(ws.path("newcerts"), 0o700); err != nil {
		return ws.fail(err)
	}
	if err := toyCAMakeCA(ws); err != nil {
		return ws.fail(err)
	}
	if err := copyFile(ws.path("ca.crt"), ws.path("ca.pem")); err != nil {
		return ws.fail(err)
	}
	if err := toyCAMakeCSR(ws); err != nil {
		return ws.fail(err)
	}
	if err := ws.prep("ca", "-batch", "-config", "openssl.cnf", "-in", "leaf.csr", "-out", "leaf.pem", "-notext"); err != nil {
		return ws.fail(err)
	}

	switch variant {
	case "revoke-setup":
		return ws.plan("x509", "-in", "leaf.pem", "-noout", "-subject", "-issuer", "-dates"), nil
	case "revoke-verify-before":
		return ws.plan("verify", "-CAfile", "ca.pem", "leaf.pem"), nil
	case "revoke-leaf":
		return ws.plan("ca", "-batch", "-config", "openssl.cnf", "-revoke", "leaf.pem"), nil
	}

	if err := ws.prep("ca", "-batch", "-config", "openssl.cnf", "-revoke", "leaf.pem"); err != nil {
		return ws.fail(err)
	}
	if err := ws.prep("ca", "-batch", "-config", "openssl.cnf", "-gencrl", "-out", "crl.pem"); err != nil {
		return ws.fail(err)
	}
	if variant == "revoke-show-crl" {
		return ws.plan("crl", "-in", "crl.pem", "-text", "-noout"), nil
	}
	return ws.plan("verify", "-CAfile", "ca.pem", "-CRLfile", "crl.pem", "-crl_check", "leaf.pem"), nil
}

// dir stays "." so openssl reports classroom-relative paths; the Run chdirs into the workspace.
const revocationCAConfig = `[ ca ]
default_ca = classroom_ca

[ classroom_ca ]
dir = .
database = $dir/index.txt
new_certs_dir = $dir/newcerts
certificate = $dir/ca.pem
private_key = $dir/ca.key
serial = $dir/serial
crlnumber = $dir/crlnumber
default_md = sha256
default_days = 30
default_crl_days = 30
policy = classroom_policy

[ classroom_policy ]
commonName = supplied
`

func copyFile(source, destination string) error {
	data, err := os.ReadFile(source)
	if err != nil {
		return err
	}
	return os.WriteFile(destination, data, 0o600)
}

func extractLeafPEM(output string) (string, error) {
	const begin = "-----BEGIN CERTIFICATE-----"
	const end = "-----END CERTIFICATE-----"
	start := strings.Index(output, begin)
	if start < 0 {
		return "", fmt.Errorf("live TLS response did not contain a certificate")
	}
	finish := strings.Index(output[start:], end)
	if finish < 0 {
		return "", fmt.Errorf("live TLS response contained an incomplete certificate")
	}
	finish = start + finish + len(end)
	return strings.TrimSpace(output[start:finish]) + "\n", nil
}

func inspectCertificate(pem string) ([]CertField, error) {
	bin, err := exec.LookPath("openssl")
	if err != nil {
		return nil, fmt.Errorf("openssl not found")
	}
	ctx, cancel := context.WithTimeout(context.Background(), runTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, bin, "x509", "-noout", "-text")
	cmd.Stdin = strings.NewReader(pem)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("inspect live certificate: %s", msg)
	}
	return parseCertificateText(stdout.String()), nil
}

func parseCertificateText(text string) []CertField {
	lines := strings.Split(text, "\n")
	firstValue := func(prefix string) string {
		for i, raw := range lines {
			line := strings.TrimSpace(raw)
			if strings.HasPrefix(line, prefix) {
				value := strings.TrimSpace(strings.TrimPrefix(line, prefix))
				if value != "" {
					return value
				}
				for _, following := range lines[i+1:] {
					value = strings.TrimSpace(following)
					if value != "" {
						return value
					}
				}
			}
		}
		return "Not reported"
	}
	allValues := func(prefix string) []string {
		var values []string
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, prefix) {
				values = append(values, strings.TrimSpace(strings.TrimPrefix(line, prefix)))
			}
		}
		return values
	}
	blockAfter := func(marker string, stop func(string) bool) string {
		var values []string
		capturing := false
		for _, raw := range lines {
			line := strings.TrimSpace(raw)
			if !capturing {
				if line == marker {
					capturing = true
				}
				continue
			}
			if stop(line) {
				break
			}
			if line != "" {
				values = append(values, line)
			}
		}
		if len(values) == 0 {
			return "Not reported"
		}
		return strings.Join(values, " ")
	}

	signatures := allValues("Signature Algorithm:")
	certSignatureAlgorithm := "Not reported"
	if len(signatures) > 1 {
		certSignatureAlgorithm = signatures[len(signatures)-1]
	} else if len(signatures) == 1 {
		certSignatureAlgorithm = signatures[0]
	}
	extensions := make([]string, 0)
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if strings.HasPrefix(line, "X509v3 ") && strings.Contains(line, ":") {
			extensions = append(extensions, strings.TrimSuffix(line, ": critical"))
		}
	}
	if len(extensions) == 0 {
		extensions = append(extensions, "No extensions reported")
	}
	publicKey := blockAfter("pub:", func(line string) bool {
		return strings.HasPrefix(line, "ASN1 OID:") || strings.HasPrefix(line, "NIST CURVE:")
	})
	if publicKey == "Not reported" {
		publicKey = blockAfter("Modulus:", func(line string) bool {
			return strings.HasPrefix(line, "Exponent:")
		})
	}
	signatureBytes := blockAfter("Signature Value:", func(string) bool { return false })

	return []CertField{
		{Name: "Version number", Value: firstValue("Version:")},
		{Name: "Serial number", Value: firstValue("Serial Number:")},
		{Name: "Signature algorithm ID", Value: firstValue("Signature Algorithm:")},
		{Name: "Issuer name", Value: firstValue("Issuer:")},
		{Name: "Validity period", Value: firstValue("Not Before:") + " → " + firstValue("Not After :")},
		{Name: "Subject name", Value: firstValue("Subject:")},
		{Name: "Public key algorithm", Value: firstValue("Public Key Algorithm:")},
		{Name: "Subject public key", Value: publicKey},
		{Name: "Other optional fields", Value: strings.Join(extensions, ", ")},
		{Name: "Certificate signature algorithm", Value: certSignatureAlgorithm},
		{Name: "Certificate signature", Value: signatureBytes},
	}
}

func handshakeArgv(req RunRequest) (runPlan, error) {
	switch req.Variant {
	case "cipher-suite":
		// Local only: print OpenSSL's idea of one suite line.
		return runPlan{args: []string{"ciphers", "-v", "ECDHE-RSA-AES128-GCM-SHA256"}}, nil
	case "dh-text":
		ws, err := newWorkspace(map[string]string{"dh.pem": cannedDHParamPEM})
		if err != nil {
			return runPlan{}, err
		}
		return ws.plan("dhparam", "-in", "dh.pem", "-text", "-noout"), nil
	case "dh-gen-alice", "dh-gen-bob":
		// Teaching DH private key from canned params (stdout PEM; same as -out alice.pem / bob.pem).
		ws, err := newWorkspace(map[string]string{"dh.pem": cannedDHParamPEM})
		if err != nil {
			return runPlan{}, err
		}
		return ws.plan("genpkey", "-paramfile", "dh.pem"), nil
	case "dh-bob-pub":
		pem := strings.TrimSpace(req.PrivatePEM)
		if pem == "" {
			return runPlan{}, fmt.Errorf("run Bob’s private key first, then derive his public key")
		}
		ws, err := newWorkspace(map[string]string{"bob.pem": pem})
		if err != nil {
			return runPlan{}, err
		}
		return ws.plan("pkey", "-in", "bob.pem", "-pubout"), nil
	case "dh-derive":
		alice := strings.TrimSpace(req.PrivatePEM)
		bobPub := strings.TrimSpace(req.PublicPEM)
		if alice == "" || bobPub == "" {
			return runPlan{}, fmt.Errorf("run Alice’s private key and Bob’s public key first, then derive")
		}
		ws, err := newWorkspace(map[string]string{"alice.pem": alice, "bob.pub": bobPub})
		if err != nil {
			return runPlan{}, err
		}
		return ws.plan("pkeyutl", "-derive", "-inkey", "alice.pem", "-peerkey", "bob.pub"), nil
	default:
		return runPlan{}, fmt.Errorf("unknown handshake variant %q", req.Variant)
	}
}

// signArgv: key-pair generation for Part 6.5 (and related). Keys are teaching demos — not for production.
func signArgv(req RunRequest) (runPlan, error) {
	switch req.Variant {
	case "ec-gen-private":
		// Private key PEM on stdout (same idea as writing private.pem).
		return runPlan{args: []string{
			"genpkey",
			"-algorithm", "EC",
			"-pkeyopt", "ec_paramgen_curve:P-256",
		}}, nil
	case "ec-show-public":
		ws, err := newGeneratedKeyWorkspace("ec")
		if err != nil {
			return runPlan{}, err
		}
		return ws.plan("pkey", "-in", "private.pem", "-pubout"), nil
	case "rsa-gen-private":
		return runPlan{args: []string{"genrsa", "2048"}}, nil
	case "rsa-show-public":
		ws, err := newGeneratedKeyWorkspace("rsa")
		if err != nil {
			return runPlan{}, err
		}
		return ws.plan("rsa", "-in", "private.pem", "-pubout"), nil
	default:
		return runPlan{}, fmt.Errorf("unknown sign variant %q", req.Variant)
	}
}

// newGeneratedKeyWorkspace stages a fresh private.pem for the “derive public” demos.
func newGeneratedKeyWorkspace(kind string) (*workspace, error) {
	ws, err := newWorkspace(nil)
	if err != nil {
		return nil, err
	}
	switch kind {
	case "ec":
		err = ws.prep("genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256", "-out", "private.pem")
	case "rsa":
		err = ws.prep("genrsa", "-out", "private.pem", "2048")
	default:
		err = fmt.Errorf("unknown key kind %q", kind)
	}
	if err != nil {
		ws.cleanup()
		return nil, err
	}
	return ws, nil
}

func foundationsArgv(req RunRequest) (runPlan, error) {
	switch req.Variant {
	case "b64-encode":
		return runPlan{args: []string{"enc", "-base64", "-e"}, stdin: []byte(req.Plaintext)}, nil
	case "b64-decode":
		stdin := []byte(req.Plaintext)
		if req.InputB64 != "" {
			stdin = []byte(req.InputB64)
		}
		return runPlan{args: []string{"enc", "-base64", "-d"}, stdin: stdin}, nil
	case "sha256":
		return runPlan{args: []string{"dgst", "-sha256"}, stdin: []byte(req.Plaintext)}, nil
	case "md5":
		return runPlan{args: []string{"dgst", "-md5"}, stdin: []byte(req.Plaintext)}, nil
	default:
		return runPlan{}, fmt.Errorf("unknown foundations variant %q", req.Variant)
	}
}

func rc4Argv(req RunRequest) (runPlan, error) {
	dir := strings.ToLower(req.Direction)
	if dir == "" {
		dir = "encrypt"
	}
	flag := "-e"
	stdin := []byte(req.Plaintext)
	if dir == "decrypt" {
		flag = "-d"
		if req.InputB64 == "" {
			return runPlan{}, fmt.Errorf("inputB64 required for rc4 decrypt")
		}
		// openssl -a base64 decode expects a trailing newline.
		stdin = []byte(strings.TrimSpace(req.InputB64) + "\n")
	}

	pass := strings.TrimSpace(req.Passphrase)
	key := strings.TrimSpace(req.KeyHex)

	args := []string{
		"enc", "-rc4",
		"-provider", "default",
		"-provider", "legacy",
		"-nosalt",
	}
	// Prefer -k (passphrase) when provided — OpenSSL derives the key.
	if pass != "" {
		args = append(args, "-k", pass, flag, "-a")
	} else {
		if key == "" {
			return runPlan{}, fmt.Errorf("passphrase or keyHex required for rc4")
		}
		args = append(args, "-K", key, flag, "-a")
	}
	return runPlan{args: args, stdin: stdin}, nil
}

func desArgv(req RunRequest) (runPlan, error) {
	dir := strings.ToLower(req.Direction)
	if dir == "" {
		dir = "encrypt"
	}
	flag := "-e"
	stdin := []byte(req.Plaintext)
	if dir == "decrypt" {
		flag = "-d"
		if req.InputB64 == "" {
			return runPlan{}, fmt.Errorf("inputB64 required for des decrypt")
		}
		stdin = []byte(strings.TrimSpace(req.InputB64) + "\n")
	}

	pass := strings.TrimSpace(req.Passphrase)
	key := strings.TrimSpace(req.KeyHex)
	iv := strings.TrimSpace(req.IVHex)
	if iv == "" {
		iv = "0000000000000000"
	}

	args := []string{
		"enc", "-des-cbc",
		"-provider", "default",
		"-provider", "legacy",
		"-nosalt",
		"-iv", iv,
	}
	if pass != "" {
		args = append(args, "-k", pass, flag, "-a")
	} else {
		if key == "" {
			return runPlan{}, fmt.Errorf("passphrase or keyHex required for des")
		}
		args = append(args, "-K", key, flag, "-a")
	}
	return runPlan{args: args, stdin: stdin}, nil
}

func tdesArgv(req RunRequest) (runPlan, error) {
	dir := strings.ToLower(req.Direction)
	if dir == "" {
		dir = "encrypt"
	}
	flag := "-e"
	stdin := []byte(req.Plaintext)
	if dir == "decrypt" {
		flag = "-d"
		if req.InputB64 == "" {
			return runPlan{}, fmt.Errorf("inputB64 required for tdes decrypt")
		}
		stdin = []byte(strings.TrimSpace(req.InputB64) + "\n")
	}

	pass := strings.TrimSpace(req.Passphrase)
	key := strings.TrimSpace(req.KeyHex)
	iv := strings.TrimSpace(req.IVHex)
	if iv == "" {
		iv = "0000000000000000"
	}

	args := []string{
		"enc", "-des-ede3-cbc",
		"-provider", "default",
		"-provider", "legacy",
		"-nosalt",
		"-iv", iv,
	}
	if pass != "" {
		args = append(args, "-k", pass, flag, "-a")
	} else {
		if key == "" {
			return runPlan{}, fmt.Errorf("passphrase or keyHex required for tdes")
		}
		args = append(args, "-K", key, flag, "-a")
	}
	return runPlan{args: args, stdin: stdin}, nil
}

func aesArgv(req RunRequest) (runPlan, error) {
	dir := strings.ToLower(req.Direction)
	if dir == "" {
		dir = "encrypt"
	}
	flag := "-e"
	stdin := []byte(req.Plaintext)
	if dir == "decrypt" {
		flag = "-d"
		if req.InputB64 == "" {
			return runPlan{}, fmt.Errorf("inputB64 required for aes decrypt")
		}
		stdin = []byte(strings.TrimSpace(req.InputB64) + "\n")
	}

	bits := req.KeyBits
	if bits == 0 {
		bits = 128
	}
	var cipherFlag string
	switch bits {
	case 128:
		cipherFlag = "-aes-128-cbc"
	case 192:
		cipherFlag = "-aes-192-cbc"
	case 256:
		cipherFlag = "-aes-256-cbc"
	default:
		return runPlan{}, fmt.Errorf("keyBits must be 128, 192, or 256")
	}

	pass := strings.TrimSpace(req.Passphrase)
	key := strings.TrimSpace(req.KeyHex)
	iv := strings.TrimSpace(req.IVHex)
	if iv == "" {
		iv = "00000000000000000000000000000000"
	}

	args := []string{
		"enc", cipherFlag,
		"-nosalt",
		"-iv", iv,
	}
	if pass != "" {
		args = append(args, "-k", pass, flag, "-a")
	} else {
		if key == "" {
			return runPlan{}, fmt.Errorf("passphrase or keyHex required for aes")
		}
		args = append(args, "-K", key, flag, "-a")
	}
	return runPlan{args: args, stdin: stdin}, nil
}

// decodeB64 is a small helper for later parts.
func decodeB64(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	return base64.StdEncoding.DecodeString(s)
}
