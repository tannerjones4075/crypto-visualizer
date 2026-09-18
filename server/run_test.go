package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTrustSClientGoogleUsesFixedTarget(t *testing.T) {
	plan, err := trustArgv(RunRequest{
		Part:       "trust",
		Variant:    "s_client-google",
		Plaintext:  "ignored",
		Passphrase: "ignored",
	})
	if plan.cleanup != nil {
		defer plan.cleanup()
	}
	if err != nil {
		t.Fatalf("trustArgv returned error: %v", err)
	}
	got := strings.Join(plan.args, " ")
	want := "s_client -connect www.google.com:443 -servername www.google.com -showcerts"
	if got != want {
		t.Fatalf("fixed argv = %q, want %q", got, want)
	}
	if len(plan.stdin) != 0 {
		t.Fatalf("stdin = %q, want empty", plan.stdin)
	}
}

func TestTrustToyCAVariantsUseCannedSubjects(t *testing.T) {
	cases := []struct {
		variant  string
		wantHead string
		wantArgs []string
		wantFile string
	}{
		{
			variant:  "toy-ca-gen",
			wantHead: "req",
			wantArgs: []string{"-x509", "-newkey", "rsa:2048", "-noenc", "-subj", toyCASubject},
		},
		{
			variant:  "toy-csr-subject",
			wantHead: "req",
			wantArgs: []string{"-noout", "-subject", "-verify"},
			wantFile: "leaf.csr",
		},
		{
			variant:  "toy-ca-sign",
			wantHead: "x509",
			wantArgs: []string{"-req", "-CAcreateserial", "-sha256"},
			wantFile: "ca.crt",
		},
		{
			variant:  "toy-chain-verify",
			wantHead: "verify",
			wantArgs: []string{"-CAfile"},
			wantFile: "leaf.crt",
		},
		{
			variant:  "toy-leaf-fields",
			wantHead: "x509",
			wantArgs: []string{"-noout", "-subject", "-issuer", "-dates", "-serial"},
			wantFile: "leaf.crt",
		},
	}

	for _, tc := range cases {
		t.Run(tc.variant, func(t *testing.T) {
			plan, err := trustArgv(RunRequest{
				Part:       "trust",
				Variant:    tc.variant,
				Plaintext:  "ignored",
				Passphrase: "ignored",
				PrivatePEM: "ignored",
			})
			if plan.cleanup != nil {
				defer plan.cleanup()
			}
			if err != nil {
				t.Fatalf("trustArgv(%s) returned error: %v", tc.variant, err)
			}
			if len(plan.stdin) != 0 {
				t.Fatalf("stdin = %q, want empty", plan.stdin)
			}
			if plan.args[0] != tc.wantHead {
				t.Fatalf("args[0] = %q, want %q", plan.args[0], tc.wantHead)
			}
			joined := strings.Join(plan.args, " ")
			for _, want := range tc.wantArgs {
				if !strings.Contains(joined, want) {
					t.Fatalf("argv %q missing %q", joined, want)
				}
			}
			if strings.Contains(joined, "ignored") {
				t.Fatalf("argv %q leaked a browser-supplied field", joined)
			}
			if tc.wantFile != "" {
				if !hasArg(plan.args, tc.wantFile) {
					t.Fatalf("argv %q never references %s", joined, tc.wantFile)
				}
				if _, err := os.Stat(filepath.Join(plan.dir, tc.wantFile)); err != nil {
					t.Fatalf("%s was not prepared: %v", tc.wantFile, err)
				}
			}
		})
	}
}

func hasArg(args []string, want string) bool {
	for _, arg := range args {
		if arg == want {
			return true
		}
	}
	return false
}

func TestTrustToyCACleanupRemovesWorkspace(t *testing.T) {
	plan, err := trustArgv(RunRequest{Part: "trust", Variant: "toy-chain-verify"})
	if err != nil {
		t.Fatalf("trustArgv returned error: %v", err)
	}
	plan.cleanup()
	if _, err := os.Stat(plan.dir); !os.IsNotExist(err) {
		t.Fatalf("workspace %s still present after cleanup (err=%v)", plan.dir, err)
	}
}

func TestTrustToyCAChainVerifies(t *testing.T) {
	resp := runOpenSSL(context.Background(), RunRequest{Part: "trust", Variant: "toy-chain-verify"})
	if resp.Error != "" {
		t.Fatalf("toy-chain-verify error: %s (stderr=%s)", resp.Error, resp.Stderr)
	}
	if !strings.Contains(resp.Stdout, "OK") {
		t.Fatalf("toy chain did not verify: stdout=%q stderr=%q", resp.Stdout, resp.Stderr)
	}
}

func TestTrustToyCAIdentityStepShowsClaimedName(t *testing.T) {
	resp := runOpenSSL(context.Background(), RunRequest{Part: "trust", Variant: "toy-csr-subject"})
	if resp.Error != "" {
		t.Fatalf("toy-csr-subject error: %s (stderr=%s)", resp.Error, resp.Stderr)
	}
	if !strings.Contains(resp.Stdout, "CN=alice.example") {
		t.Fatalf("claimed name missing: stdout=%q stderr=%q", resp.Stdout, resp.Stderr)
	}
}

func TestTrustToyCASignProducesCertificateSignedByCA(t *testing.T) {
	resp := runOpenSSL(context.Background(), RunRequest{Part: "trust", Variant: "toy-ca-sign"})
	if resp.Error != "" {
		t.Fatalf("toy-ca-sign error: %s (stderr=%s)", resp.Error, resp.Stderr)
	}
	if !strings.Contains(resp.Stdout, "BEGIN CERTIFICATE") {
		t.Fatalf("expected a signed certificate PEM, got %q", resp.Stdout)
	}
	fields, err := inspectCertificate(resp.Stdout)
	if err != nil {
		t.Fatalf("inspectCertificate returned error: %v", err)
	}
	byName := map[string]string{}
	for _, f := range fields {
		byName[f.Name] = f.Value
	}
	if !strings.Contains(byName["Issuer name"], "Crypto Visualizer Classroom CA") {
		t.Fatalf("issuer = %q, want the toy CA", byName["Issuer name"])
	}
	if !strings.Contains(byName["Subject name"], "alice.example") {
		t.Fatalf("subject = %q, want alice.example", byName["Subject name"])
	}
}

func TestTrustRejectsUnknownVariant(t *testing.T) {
	if _, err := trustArgv(RunRequest{Part: "trust", Variant: "rm-rf"}); err == nil {
		t.Fatal("unknown trust variant should be rejected")
	}
}

func TestExtractLeafPEMReturnsFirstCertificate(t *testing.T) {
	input := "CONNECTED\n" + cannedGoogleLeafPEM + "\n" +
		"-----BEGIN CERTIFICATE-----\nSECOND\n-----END CERTIFICATE-----\n"
	got, err := extractLeafPEM(input)
	if err != nil {
		t.Fatalf("extractLeafPEM returned error: %v", err)
	}
	if got != strings.TrimSpace(cannedGoogleLeafPEM)+"\n" {
		t.Fatal("extractLeafPEM did not return the first complete certificate")
	}
}

func TestExtractLeafPEMRejectsMissingCertificate(t *testing.T) {
	if _, err := extractLeafPEM("CONNECTED\nno certificate\n"); err == nil {
		t.Fatal("extractLeafPEM should reject output without a certificate")
	}
}

func TestInspectCertificateReturnsClassroomFields(t *testing.T) {
	fields, err := inspectCertificate(cannedGoogleLeafPEM)
	if err != nil {
		t.Fatalf("inspectCertificate returned error: %v", err)
	}
	if len(fields) != 11 {
		t.Fatalf("field count = %d, want 11", len(fields))
	}
	if fields[0].Name != "Version number" || fields[5].Name != "Subject name" {
		t.Fatalf("unexpected field order: %#v", fields)
	}
	for _, field := range fields {
		if strings.TrimSpace(field.Value) == "" {
			t.Fatalf("%s has an empty value", field.Name)
		}
	}
}

func TestAPIRouteWorksWithLegacyMuxCompatibility(t *testing.T) {
	t.Setenv("GODEBUG", "httpmuxgo121=1")
	req := httptest.NewRequest(http.MethodPost, "/api/run", strings.NewReader(
		`{"part":"trust","variant":"hmac-sha256","plaintext":"hello","passphrase":"key"}`,
	))
	recorder := httptest.NewRecorder()
	newMux().ServeHTTP(recorder, req)
	if recorder.Code == http.StatusNotFound {
		t.Fatal("POST /api/run fell through to the static file server")
	}
}

func TestTrustRevokeVariantsAreCanned(t *testing.T) {
	tests := []struct {
		variant string
		want    string
	}{
		// The argv must read exactly like the command printed next to the Run button.
		{"revoke-setup", "x509 -in leaf.pem -noout -subject -issuer -dates"},
		{"revoke-verify-before", "verify -CAfile ca.pem leaf.pem"},
		{"revoke-leaf", "ca -batch -config openssl.cnf -revoke leaf.pem"},
		{"revoke-show-crl", "crl -in crl.pem -text -noout"},
		{"revoke-verify-after", "verify -CAfile ca.pem -CRLfile crl.pem -crl_check leaf.pem"},
	}

	for _, tt := range tests {
		t.Run(tt.variant, func(t *testing.T) {
			plan, err := trustArgv(RunRequest{Part: "trust", Variant: tt.variant})
			if plan.cleanup != nil {
				defer plan.cleanup()
			}
			if err != nil {
				t.Fatalf("trustArgv returned error: %v", err)
			}
			if got := strings.Join(plan.args, " "); got != tt.want {
				t.Fatalf("argv = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestTrustVerifyWithCRLFailsAfterRevoke(t *testing.T) {
	resp := runOpenSSL(context.Background(), RunRequest{
		Part:    "trust",
		Variant: "revoke-verify-after",
	})
	if !strings.Contains(resp.Stderr, "certificate revoked") {
		t.Fatalf("stderr = %q, want certificate revoked", resp.Stderr)
	}
	if !strings.Contains(resp.Stderr, "error leaf.pem: verification failed") {
		t.Fatalf("stderr = %q, want the failure reported against leaf.pem", resp.Stderr)
	}
	if resp.Error != "" {
		t.Fatalf("error = %q, want OpenSSL verification failure in stderr only", resp.Error)
	}
}

func TestTrustRevokeLeafReportsRelativeConfig(t *testing.T) {
	resp := runOpenSSL(context.Background(), RunRequest{Part: "trust", Variant: "revoke-leaf"})
	if !strings.Contains(resp.Stderr, "Using configuration from openssl.cnf") {
		t.Fatalf("stderr = %q, want the relative config name", resp.Stderr)
	}
	if !strings.Contains(resp.Stderr, "Revoking Certificate 1000") {
		t.Fatalf("stderr = %q, want the leaf serial", resp.Stderr)
	}
}

func TestTlsIpsecSelfSignedVariants(t *testing.T) {
	cases := []struct {
		variant  string
		wantHead string
		wantArgs []string
		wantFile string
	}{
		{
			variant:  "selfsigned-gen",
			wantHead: "req",
			wantArgs: []string{"-x509", "-newkey", "rsa:2048", "-noenc", "-subj", tlsServerSubject, "-keyout", "server.key"},
		},
		{
			variant:  "selfsigned-show",
			wantHead: "x509",
			wantArgs: []string{"-noout", "-subject", "-issuer", "-dates", "-serial"},
			wantFile: "server.crt",
		},
	}

	for _, tc := range cases {
		t.Run(tc.variant, func(t *testing.T) {
			plan, err := tlsipsecArgv(RunRequest{
				Part:      "tlsipsec",
				Variant:   tc.variant,
				Plaintext: "tls-cert",
			})
			if plan.cleanup != nil {
				defer plan.cleanup()
			}
			if err != nil {
				t.Fatalf("tlsipsecArgv(%s) returned error: %v", tc.variant, err)
			}
			if len(plan.args) == 0 || plan.args[0] != tc.wantHead {
				t.Fatalf("head = %q, want %q", plan.args, tc.wantHead)
			}
			got := strings.Join(plan.args, " ")
			for _, a := range tc.wantArgs {
				if !strings.Contains(got, a) {
					t.Fatalf("argv %q missing %q", got, a)
				}
			}
			if tc.wantFile != "" {
				if _, err := os.Stat(filepath.Join(plan.dir, tc.wantFile)); err != nil {
					t.Fatalf("expected file %s: %v", tc.wantFile, err)
				}
			}
		})
	}
}

func TestTlsIpsecUnknownVariantRejected(t *testing.T) {
	if _, err := tlsipsecArgv(RunRequest{Part: "tlsipsec", Variant: "rm-rf"}); err == nil {
		t.Fatal("unknown tlsipsec variant should be rejected")
	}
}

func TestTlsIpsecSelfSignedGenPrintsCertificate(t *testing.T) {
	resp := runOpenSSL(context.Background(), RunRequest{Part: "tlsipsec", Variant: "selfsigned-gen", Plaintext: "tls-cert"})
	if !strings.Contains(resp.Stdout, "BEGIN CERTIFICATE") {
		t.Fatalf("stdout missing certificate:\n%s\nerr=%s stderr=%s", resp.Stdout, resp.Error, resp.Stderr)
	}
}

func TestTlsIpsecRunsNeverExposeHostPaths(t *testing.T) {
	variants := []string{"selfsigned-gen", "selfsigned-show"}
	tempRoots := []string{os.TempDir(), "/var/folders", "/private/var/folders", "cv-run-"}
	for _, variant := range variants {
		t.Run(variant, func(t *testing.T) {
			resp := runOpenSSL(context.Background(), RunRequest{Part: "tlsipsec", Variant: variant, Plaintext: "tls-cert"})
			text := strings.Join(resp.Argv, " ") + "\n" + resp.Stdout + "\n" + resp.Stderr + "\n" + resp.Error
			for _, root := range tempRoots {
				if root == "" {
					continue
				}
				if strings.Contains(text, strings.TrimSuffix(root, "/")) {
					t.Fatalf("%s output mentions host path %q:\n%s", variant, root, text)
				}
			}
		})
	}
}
	variants := []string{
		"toy-ca-gen", "toy-csr-subject", "toy-ca-sign", "toy-chain-verify", "toy-leaf-fields",
		"revoke-setup", "revoke-verify-before", "revoke-leaf", "revoke-show-crl", "revoke-verify-after",
		"x509-text",
	}
	tempRoots := []string{os.TempDir(), "/var/folders", "/private/var/folders", "cv-run-"}

	for _, variant := range variants {
		t.Run(variant, func(t *testing.T) {
			resp := runOpenSSL(context.Background(), RunRequest{Part: "trust", Variant: variant})
			text := strings.Join(resp.Argv, " ") + "\n" + resp.Stdout + "\n" + resp.Stderr + "\n" + resp.Error
			for _, root := range tempRoots {
				if root == "" {
					continue
				}
				if strings.Contains(text, strings.TrimSuffix(root, "/")) {
					t.Fatalf("%s output mentions host path %q:\n%s", variant, root, text)
				}
			}
		})
	}
}
