import { useState } from "react";

export function LayerStackDiagram() {
  return (
    <figure className="tlsip-fig">
      <div className="tlsip-stack" aria-label="Where TLS and IPsec sit in the networking stack">
        <div className="tlsip-layer">
          <span className="tlsip-layer-name">Application Layer</span>
          <small>HTTPS, mail, APIs</small>
        </div>
        <div className="tlsip-join tlsip-join-tls">
          <span className="tlsip-join-arrow" aria-hidden="true">
            ▼
          </span>
          <span className="tlsip-chip tlsip-chip-tls">TLS</span>
          <span className="tlsip-join-note">protects the application conversation (above transport)</span>
        </div>
        <div className="tlsip-layer">
          <span className="tlsip-layer-name">Transport Layer</span>
          <small>TCP / UDP</small>
        </div>
        <div className="tlsip-join tlsip-join-ipsec">
          <span className="tlsip-join-arrow" aria-hidden="true">
            ▼
          </span>
          <span className="tlsip-chip tlsip-chip-ipsec">IPsec</span>
          <span className="tlsip-join-note">protects IP packets (at the network layer)</span>
        </div>
        <div className="tlsip-layer">
          <span className="tlsip-layer-name">Network Layer</span>
          <small>IP</small>
        </div>
        <div className="tlsip-join tlsip-join-plain">
          <span className="tlsip-join-arrow" aria-hidden="true">
            ▼
          </span>
        </div>
        <div className="tlsip-layer">
          <span className="tlsip-layer-name">Data Link Layer</span>
        </div>
        <div className="tlsip-join tlsip-join-plain">
          <span className="tlsip-join-arrow" aria-hidden="true">
            ▼
          </span>
        </div>
        <div className="tlsip-layer">
          <span className="tlsip-layer-name">Physical Layer</span>
        </div>
      </div>
      <figcaption>
        TLS is not “the transport layer.” It rides above transport, typically over TCP. IPsec is not
        an extra OSI layer — it protects IP.
      </figcaption>
    </figure>
  );
}

const TLS_WALK_STEPS = [
  {
    id: 1,
    title: "ClientHello",
    hop: "client",
    body: "The client opens TCP to the server, then sends a ClientHello in the clear: TLS versions and cipher suites (same idea as 6.1). IP addresses and ports are still visible — TLS is not IPsec.",
  },
  {
    id: 2,
    title: "Hello + cert",
    hop: "server",
    body: "The server picks a suite and sends ServerHello plus a certificate. The client checks the CA signature (7.1) so it knows whose public key this is.",
  },
  {
    id: 3,
    title: "Key exchange",
    hop: "client",
    body: "Both sides send public key-exchange values (6.3). Private keys never go on the wire. From those values they will derive session keys.",
  },
  {
    id: 4,
    title: "Session keys",
    hop: "keys",
    body: "Each side computes the same symmetric session keys locally. Those keys are not transmitted. Handshake Finished messages prove the keys work.",
  },
  {
    id: 5,
    title: "App data",
    hop: "data",
    body: "Application bytes travel in TLS records encrypted with the session keys (6.4 / AES). The path still sees TCP 443 and the real IPs — only the HTTP payload is hidden.",
  },
];

export function TlsHandshakeDiagram() {
  const [step, setStep] = useState(1);
  const active = TLS_WALK_STEPS.find((s) => s.id === step) ?? TLS_WALK_STEPS[0];

  return (
    <figure className="tlsip-fig">
      <StepNav steps={TLS_WALK_STEPS} step={step} setStep={setStep} />
      <div className="tlsip-s2s" aria-label="TLS handshake and record path">
        <div
          className={`tlsip-s2s-hop ${active.hop === "client" || active.hop === "keys" || active.hop === "data" ? "lit" : ""}`}
        >
          <strong>Client</strong>
          <small>203.0.113.10 · browser / app</small>
          <span className="tlsip-s2s-host">TCP 51244 → 443</span>
        </div>
        <div
          className={`tlsip-tunnel ${active.hop === "data" ? "lit" : ""}`}
        >
          <span className="tlsip-tunnel-label">
            {step < 5 ? "TCP path · handshake still readable" : "TCP path · TLS records encrypted"}
          </span>
          <span className="tlsip-tunnel-sub">Internet still sees 203.0.113.10 → 198.51.100.20:443</span>
        </div>
        <div
          className={`tlsip-s2s-hop ${active.hop === "server" || active.hop === "keys" || active.hop === "data" ? "lit" : ""}`}
        >
          <strong>Server</strong>
          <small>198.51.100.20 · tls.example</small>
          <span className="tlsip-s2s-host">Presents certificate · then session keys</span>
        </div>
      </div>
      <StepCopy step={active} />
      {step === 1 ? (
        <div className="tlsip-wire" aria-label="ClientHello on the wire">
          <div className="tlsip-wire-box clear-ip">
            <p className="tlsip-wire-h">IP header (visible)</p>
            <p>
              Src: <code>203.0.113.10</code> → Dst: <code>198.51.100.20</code>
            </p>
          </div>
          <div className="tlsip-wire-box clear-tcp">
            <p className="tlsip-wire-h">TCP (visible)</p>
            <p>
              Ports: <code>51244 → 443</code>
            </p>
          </div>
          <div className="tlsip-wire-box clear-data">
            <p className="tlsip-wire-h">TLS handshake (clear)</p>
            <p>
              ClientHello · TLS 1.3 · suites: <code>AES-GCM</code>, …
            </p>
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="tlsip-wire" aria-label="ServerHello and certificate on the wire">
          <div className="tlsip-wire-box clear-ip">
            <p className="tlsip-wire-h">IP + TCP (visible)</p>
            <p>
              <code>198.51.100.20:443 → 203.0.113.10:51244</code>
            </p>
          </div>
          <div className="tlsip-wire-box outer">
            <p className="tlsip-wire-h">TLS handshake (clear)</p>
            <p>ServerHello · chosen suite</p>
            <p>
              Certificate: CN=<code>tls.example</code> (CA-signed — 7.1)
            </p>
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="tlsip-wire" aria-label="Key exchange on the wire">
          <div className="tlsip-wire-box clear-tcp">
            <p className="tlsip-wire-h">On the wire</p>
            <p>Public key-share / DH value (not the private key)</p>
          </div>
          <div className="tlsip-wire-box esp">
            <p className="tlsip-wire-h">Stays private</p>
            <p>Client secret · server secret → session keys later</p>
          </div>
        </div>
      ) : null}
      {step === 4 ? (
        <div className="tlsip-wire" aria-label="Session keys derived locally">
          <p className="tlsip-wire-sep" style={{ marginTop: 0 }}>
            Not a packet — keys are computed, not sent
          </p>
          <div className="tlsip-wire-box esp">
            <p className="tlsip-wire-h">Session keys</p>
            <p>Symmetric keys for encrypt + integrity (AEAD)</p>
            <p>Finished / verify: both sides prove they have the same keys</p>
          </div>
        </div>
      ) : null}
      {step === 5 ? (
        <div className="tlsip-wire" aria-label="Encrypted TLS application record">
          <div className="tlsip-wire-box clear-ip">
            <p className="tlsip-wire-h">IP header (still visible)</p>
            <p>
              Src: <code>203.0.113.10</code> → Dst: <code>198.51.100.20</code>
            </p>
          </div>
          <div className="tlsip-wire-box clear-tcp">
            <p className="tlsip-wire-h">TCP (still visible)</p>
            <p>
              Ports: <code>51244 → 443</code> — this looks like HTTPS
            </p>
          </div>
          <div className="tlsip-wire-box esp">
            <p className="tlsip-wire-h">TLS record</p>
            <p className="tlsip-wire-sep">— encrypted application data —</p>
            <div className="tlsip-wire-hidden">
              <p className="tlsip-wire-h dim">HTTP (hidden)</p>
              <p className="gib">GET /secret …</p>
            </div>
            <p>AEAD tag (integrity)</p>
          </div>
        </div>
      ) : null}
      <figcaption>
        Handshake messages are readable enough to set up keys. After that, application data is
        encrypted — but TLS does not hide IP addresses the way an IPsec tunnel does.
      </figcaption>
    </figure>
  );
}

export function VpnOnOffDiagram() {
  const [on, setOn] = useState(true);

  return (
    <figure className="tlsip-fig tlsip-vpn-lab">
      <h4 className="tlsip-vpn-lab-title">Interactive: VPN on vs. VPN off</h4>
      <p className="caption">
        Toggle the switch to see how the packet looks with and without encryption. Notice how the
        payload — and the original addresses — change.
      </p>
      <div className="tlsip-vpn-card">
        <button
          type="button"
          className={`tlsip-switch ${on ? "on" : ""}`}
          role="switch"
          aria-checked={on}
          onClick={() => setOn((v) => !v)}
        >
          <span className="tlsip-switch-track" aria-hidden="true">
            <span className="tlsip-switch-knob" />
          </span>
          <span className="tlsip-switch-label">{on ? "VPN on" : "VPN off"}</span>
        </button>

        <div className="tlsip-wire" aria-label={on ? "Tunneled IPsec packet" : "Clear IP packet"}>
          {on ? (
            <>
              <div className="tlsip-wire-box outer">
                <p className="tlsip-wire-h">Outer IP header (new)</p>
                <p>
                  Src: <code>203.0.113.1</code> (VPN Gateway A)
                </p>
                <p>
                  Dst: <code>198.51.100.1</code> (VPN Gateway B)
                </p>
              </div>
              <div className="tlsip-wire-box esp">
                <p className="tlsip-wire-h">ESP header</p>
                <p>
                  SPI: <code>0xA3B7C901</code> | Seq: <code>4827</code>
                </p>
                <p className="tlsip-wire-sep">— encrypted payload —</p>
                <div className="tlsip-wire-hidden">
                  <p className="tlsip-wire-h dim">Original IP (hidden)</p>
                  <p className="gib">kX9#mP2$vL8&amp;n05…</p>
                  <p className="tlsip-wire-h dim">TCP (hidden)</p>
                  <p className="gib">aF7*wR3!jK6%bY1…</p>
                  <p className="tlsip-wire-h dim">Data (hidden)</p>
                  <p className="gib">zT4@hN9^cU2&amp;xE8…</p>
                </div>
                <p>
                  Integrity Check Value (ICV): <code>0xE4F2…91A3</code>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="tlsip-wire-box clear-ip">
                <p className="tlsip-wire-h">Original IP header</p>
                <p>
                  Src: <code>10.0.0.5</code> (host on Network A)
                </p>
                <p>
                  Dst: <code>10.1.0.8</code> (host on Network B)
                </p>
              </div>
              <div className="tlsip-wire-box clear-tcp">
                <p className="tlsip-wire-h">TCP</p>
                <p>
                  Ports: <code>51244 → 443</code>
                </p>
              </div>
              <div className="tlsip-wire-box clear-data">
                <p className="tlsip-wire-h">Data</p>
                <p>
                  <code>GET /secret</code>
                </p>
              </div>
            </>
          )}
        </div>

        <p className={`tlsip-pkt-note ${on ? "safe" : "expose"}`}>
          {on ? (
            <>
              <strong>On the path:</strong> the outer IP header (gateway addresses) and encrypted
              gibberish. Real source, destination, and data are hidden.
            </>
          ) : (
            <>
              <strong>Visible to the path:</strong> source IP, destination IP, TCP ports, and the
              full payload. Anyone on the untrusted network can read the traffic.
            </>
          )}
        </p>
      </div>
      <figcaption>
        Tunnel-mode ESP wraps the original packet. The internet sees new gateway IPs; the inner
        packet stays encrypted.
      </figcaption>
    </figure>
  );
}

export function IpsecCards() {
  return (
    <div className="tlsip-cards" aria-label="IPsec building blocks">
      <article className="tlsip-card">
        <h4>Encapsulating Security Payload (ESP)</h4>
        <p>
          Can encrypt and authenticate. Usual VPN choice. The Integrity Check Value (ICV) is a
          fingerprint on the packet — if it does not match, the packet was altered or forged.
        </p>
      </article>
      <article className="tlsip-card">
        <h4>AH</h4>
        <p>
          Authentication Header. Integrity and authentication of the packet — no Confidentiality.
        </p>
      </article>
      <article className="tlsip-card">
        <h4>Security Association (SA)</h4>
        <p>One direction of agreed policy + keys: algorithms, SPI, how to protect this traffic.</p>
      </article>
      <article className="tlsip-card">
        <h4>Internet Key Exchange (IKE / IKEv2)</h4>
        <p>
          The protocol that sets up IPsec: peers authenticate and agree a Security Association (SA)
          and session keys. IKEv2 is the version used today.
        </p>
      </article>
      <article className="tlsip-card tlsip-card-mode">
        <h4>Tunnel mode</h4>
        <p>Wraps the original IP packet inside a new outer packet. Typical site VPN.</p>
      </article>
      <article className="tlsip-card tlsip-card-mode">
        <h4>Transport mode</h4>
        <p>
          Protects the payload; the original IP header stays. Typical host-to-host. Firewalls on the
          path cannot see ports or application data inside ESP.
        </p>
      </article>
    </div>
  );
}

function InnerClearPacket({
  src = "10.0.0.5",
  srcNote = "host on A",
  dst = "10.1.0.8",
  dstNote = "host on B",
  data = "GET /secret",
}) {
  return (
    <div className="tlsip-wire" aria-label="Inner IP packet in the clear">
      <div className="tlsip-wire-box clear-ip">
        <p className="tlsip-wire-h">Inner IP header</p>
        <p>
          Src: <code>{src}</code> ({srcNote})
        </p>
        <p>
          Dst: <code>{dst}</code> ({dstNote})
        </p>
      </div>
      <div className="tlsip-wire-box clear-tcp">
        <p className="tlsip-wire-h">TCP</p>
        <p>
          Ports: <code>51244 → 443</code>
        </p>
      </div>
      <div className="tlsip-wire-box clear-data">
        <p className="tlsip-wire-h">Data</p>
        <p>
          <code>{data}</code>
        </p>
      </div>
    </div>
  );
}

function TunnelEspPacket({
  outerSrc = "203.0.113.1",
  outerSrcNote = "VPN Gateway A",
  outerDst = "198.51.100.1",
  outerDstNote = "VPN Gateway B",
}) {
  return (
    <div className="tlsip-wire" aria-label="Tunnel-mode ESP packet">
      <div className="tlsip-wire-box outer">
        <p className="tlsip-wire-h">Outer IP header (new)</p>
        <p>
          Src: <code>{outerSrc}</code> ({outerSrcNote})
        </p>
        <p>
          Dst: <code>{outerDst}</code> ({outerDstNote})
        </p>
      </div>
      <div className="tlsip-wire-box esp">
        <p className="tlsip-wire-h">ESP header</p>
        <p>
          SPI: <code>0xA3B7C901</code> | Seq: <code>4827</code>
        </p>
        <p className="tlsip-wire-sep">— encrypted payload —</p>
        <div className="tlsip-wire-hidden">
          <p className="tlsip-wire-h dim">Original IP (hidden)</p>
          <p className="gib">kX9#mP2$vL8&amp;n05…</p>
          <p className="tlsip-wire-h dim">TCP (hidden)</p>
          <p className="gib">aF7*wR3!jK6%bY1…</p>
          <p className="tlsip-wire-h dim">Data (hidden)</p>
          <p className="gib">zT4@hN9^cU2&amp;xE8…</p>
        </div>
        <p>
          Integrity Check Value (ICV): <code>0xE4F2…91A3</code>
        </p>
      </div>
    </div>
  );
}

function TransportEspPacket() {
  return (
    <div className="tlsip-wire" aria-label="Transport-mode ESP packet">
      <div className="tlsip-wire-box clear-ip">
        <p className="tlsip-wire-h">Original IP header (stays)</p>
        <p>
          Src: <code>203.0.113.10</code> (Host A)
        </p>
        <p>
          Dst: <code>198.51.100.20</code> (Host B)
        </p>
      </div>
      <div className="tlsip-wire-box esp">
        <p className="tlsip-wire-h">ESP header</p>
        <p>
          SPI: <code>0xB21C04AA</code> | Seq: <code>19</code>
        </p>
        <p className="tlsip-wire-sep">— encrypted payload —</p>
        <div className="tlsip-wire-hidden">
          <p className="tlsip-wire-h dim">TCP (hidden)</p>
          <p className="gib">aF7*wR3!jK6%bY1…</p>
          <p className="tlsip-wire-h dim">Data (hidden)</p>
          <p className="gib">zT4@hN9^cU2&amp;xE8…</p>
        </div>
        <p>
          Integrity Check Value (ICV): <code>0x77C1…3E09</code>
        </p>
      </div>
    </div>
  );
}

function IkeAuthCard() {
  return (
    <div className="tlsip-wire" aria-label="IKE authentication before data">
      <div className="tlsip-wire-box esp">
        <p className="tlsip-wire-h">IKE / IKEv2</p>
        <p>User/device proves identity (password, certificate, MFA).</p>
        <p>Peers agree a Security Association (SA): SPI, algorithms, session keys.</p>
        <p>No application payload yet — the tunnel is not carrying GET /secret.</p>
      </div>
    </div>
  );
}

function StepCopy({ step }) {
  return (
    <div className={`tlsip-step-copy hop-${step.hop}`}>
      <p className="tlsip-step-copy-title">{step.title}</p>
      <p>{step.body}</p>
    </div>
  );
}

function StepNav({ steps, step, setStep }) {
  return (
    <ol className="tlsip-steps">
      {steps.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            className={step === s.id ? "active" : ""}
            onClick={() => setStep(s.id)}
          >
            <span className="tlsip-step-num">{s.id}</span>
            {s.title}
          </button>
        </li>
      ))}
    </ol>
  );
}

function GatewayWrapPacket() {
  return (
    <div className="tlsip-wire" aria-label="Gateway encapsulating the inner packet">
      <p className="tlsip-wire-sep" style={{ marginTop: 0 }}>
        Inner packet in · SA matched
      </p>
      <div className="tlsip-wire-box clear-ip">
        <p className="tlsip-wire-h">Inner IP (about to be wrapped)</p>
        <p>
          Src: <code>10.0.0.5</code> → Dst: <code>10.1.0.8</code>
        </p>
        <p>
          Data: <code>GET /secret</code>
        </p>
      </div>
      <p className="tlsip-wire-sep">↓ tunnel-mode ESP · new outer header</p>
      <div className="tlsip-wire-box outer">
        <p className="tlsip-wire-h">Outer IP header (new)</p>
        <p>
          Src: <code>203.0.113.1</code> · Dst: <code>198.51.100.1</code>
        </p>
      </div>
      <div className="tlsip-wire-box esp">
        <p className="tlsip-wire-h">ESP</p>
        <p>
          SPI: <code>0xA3B7C901</code> | Seq: <code>4827</code>
        </p>
        <p className="tlsip-wire-sep">inner packet now encrypted</p>
      </div>
    </div>
  );
}

const S2S_STEPS = [
  {
    id: 1,
    title: "LAN A",
    hop: "lana",
    body: "A host on Network A sends a normal IP packet toward a host on Network B. No IPsec yet — this is just LAN traffic.",
  },
  {
    id: 2,
    title: "Gateway A",
    hop: "gwa",
    body: "Gateway A matches the packet to a Security Association (SA) from IKE. It encapsulates the whole inner packet in tunnel-mode ESP and puts new outer IP addresses on it — the two gateways.",
  },
  {
    id: 3,
    title: "Internet",
    hop: "wan",
    body: "The untrusted path only sees gateway-to-gateway IP and ESP. Original LAN addresses and GET /secret stay inside the encrypted payload.",
  },
  {
    id: 4,
    title: "Gateway B",
    hop: "gwb",
    body: "Gateway B uses the SPI to find the SA and checks the Integrity Check Value (ICV) — a fingerprint that proves the packet was not altered. Then it decrypts and strips the outer header. The inner packet is restored.",
  },
  {
    id: 5,
    title: "LAN B",
    hop: "lanb",
    body: "The original packet is forwarded on Network B. Host 10.1.0.8 never knew a VPN was involved — that is why this is site-to-site.",
  },
];

export function SiteToSiteDiagram() {
  const [step, setStep] = useState(1);
  const active = S2S_STEPS.find((s) => s.id === step) ?? S2S_STEPS[0];

  return (
    <figure className="tlsip-fig">
      <StepNav steps={S2S_STEPS} step={step} setStep={setStep} />
      <div className="tlsip-s2s" aria-label="Site-to-site packet path">
        <div className={`tlsip-s2s-hop ${active.hop === "lana" ? "lit" : ""}`}>
          <strong>Network A</strong>
          <small>10.0.0.0/24 · plaintext LAN</small>
          <span className="tlsip-s2s-host">10.0.0.5 sends GET /secret → 10.1.0.8</span>
        </div>
        <div className="tlsip-v-arrow" aria-hidden="true">
          <span>▼</span>
        </div>
        <div className={`tlsip-s2s-hop gw ${active.hop === "gwa" ? "lit" : ""}`}>
          <strong>VPN Gateway A</strong>
          <small>203.0.113.1 · SA lookup · encapsulate</small>
        </div>
        <div className={`tlsip-tunnel ${active.hop === "wan" ? "lit" : ""}`}>
          <span className="tlsip-tunnel-label">Encrypted IPsec tunnel</span>
          <span className="tlsip-tunnel-sub">Internet sees only 203.0.113.1 → 198.51.100.1</span>
        </div>
        <div className={`tlsip-s2s-hop gw ${active.hop === "gwb" ? "lit" : ""}`}>
          <strong>VPN Gateway B</strong>
          <small>198.51.100.1 · ICV · decrypt · decapsulate</small>
        </div>
        <div className="tlsip-v-arrow" aria-hidden="true">
          <span>▼</span>
        </div>
        <div className={`tlsip-s2s-hop ${active.hop === "lanb" ? "lit" : ""}`}>
          <strong>Network B</strong>
          <small>10.1.0.0/24 · plaintext LAN</small>
          <span className="tlsip-s2s-host">10.1.0.8 receives GET /secret</span>
        </div>
      </div>
      <StepCopy step={active} />
      {step === 1 || step === 5 ? <InnerClearPacket /> : null}
      {step === 2 ? <GatewayWrapPacket /> : null}
      {step === 3 ? <TunnelEspPacket /> : null}
      {step === 4 ? (
        <>
          <TunnelEspPacket />
          <p className="caption">Integrity Check Value (ICV) matches the SA → decrypt and strip the outer header →</p>
          <InnerClearPacket />
        </>
      ) : null}
      <figcaption>
        Hosts never run IPsec. Gateways are the peers: they share SAs, wrap packets in tunnel-mode
        ESP, and unwrap them on the far side.
      </figcaption>
    </figure>
  );
}

const H2H_STEPS = [
  {
    id: 1,
    title: "Host A app",
    hop: "hosta",
    body: "An application on Host A builds a normal IP packet to Host B. IPsec has not wrapped it yet.",
  },
  {
    id: 2,
    title: "Host A IPsec",
    hop: "hosta",
    body: "Host A’s IPsec stack matches a Security Association (SA) with Host B. In transport mode it encrypts TCP and data but leaves the original IP header in place.",
  },
  {
    id: 3,
    title: "On the path",
    hop: "wan",
    body: "Anyone on the path still sees Host A’s and Host B’s real IP addresses. They cannot read GET /secret. Neighbors on the same LAN are not automatically covered — only this pair’s SA.",
  },
  {
    id: 4,
    title: "Host B",
    hop: "hostb",
    body: "Host B uses the SPI, checks the Integrity Check Value (ICV) to confirm the packet was not altered, decrypts, and hands the original TCP/data to the application. No gateway sat in the middle.",
  },
];

export function HostToHostDiagram() {
  const [step, setStep] = useState(1);
  const active = H2H_STEPS.find((s) => s.id === step) ?? H2H_STEPS[0];

  return (
    <figure className="tlsip-fig">
      <StepNav steps={H2H_STEPS} step={step} setStep={setStep} />
      <div className="tlsip-s2s" aria-label="Host-to-host IPsec packet path">
        <div className={`tlsip-s2s-hop ${active.hop === "hosta" ? "lit" : ""}`}>
          <strong>Host A</strong>
          <small>203.0.113.10 · IPsec on this host</small>
          <span className="tlsip-s2s-host">App sends GET /secret → 198.51.100.20</span>
        </div>
        <div className={`tlsip-tunnel ${active.hop === "wan" ? "lit" : ""}`}>
          <span className="tlsip-tunnel-label">Encrypted IPsec traffic</span>
          <span className="tlsip-tunnel-sub">Path still sees 203.0.113.10 → 198.51.100.20</span>
        </div>
        <div className={`tlsip-s2s-hop ${active.hop === "hostb" ? "lit" : ""}`}>
          <strong>Host B</strong>
          <small>198.51.100.20 · IPsec on this host</small>
          <span className="tlsip-s2s-host">App receives GET /secret</span>
        </div>
      </div>
      <StepCopy step={active} />
      {step === 1 || step === 4 ? (
        <InnerClearPacket
          src="203.0.113.10"
          srcNote="Host A"
          dst="198.51.100.20"
          dstNote="Host B"
        />
      ) : null}
      {step === 2 ? (
        <div className="tlsip-wire" aria-label="Host A applying transport-mode ESP">
          <p className="tlsip-wire-sep" style={{ marginTop: 0 }}>
            Host A SA lookup · transport mode
          </p>
          <div className="tlsip-wire-box clear-ip">
            <p className="tlsip-wire-h">IP header unchanged</p>
            <p>
              Src: <code>203.0.113.10</code> → Dst: <code>198.51.100.20</code>
            </p>
          </div>
          <p className="tlsip-wire-sep">↓ ESP encrypts TCP + data only</p>
          <div className="tlsip-wire-box esp">
            <p className="tlsip-wire-h">ESP</p>
            <p>
              SPI: <code>0xB21C04AA</code> | Seq: <code>19</code>
            </p>
          </div>
        </div>
      ) : null}
      {step === 3 ? <TransportEspPacket /> : null}
      <figcaption>
        No site gateway. The two hosts are the IPsec peers. Transport mode leaves the original IP
        header visible; only the payload is encrypted.
      </figcaption>
    </figure>
  );
}

const RA_STEPS = [
  {
    id: 1,
    title: "Authenticate",
    hop: "user",
    body: "The remote device proves who it is (credentials, certificate, MFA). IKE/IKEv2 builds a Security Association (SA) with the VPN gateway. No application data yet.",
  },
  {
    id: 2,
    title: "Inner packet",
    hop: "user",
    body: "The laptop builds a normal packet toward an internal host. The inner source is often a VPN-assigned address (10.8.0.2), not the café Wi-Fi address.",
  },
  {
    id: 3,
    title: "Device wraps",
    hop: "wrap",
    body: "The VPN client on the device encapsulates that inner packet in tunnel-mode ESP. Outer addresses are the laptop’s public IP and the corporate gateway.",
  },
  {
    id: 4,
    title: "Internet",
    hop: "wan",
    body: "The café path sees only laptop → gateway and ESP. Internal 10.1.0.8 and GET /secret stay encrypted.",
  },
  {
    id: 5,
    title: "Gateway + LAN",
    hop: "lan",
    body: "The gateway checks the Integrity Check Value (ICV), decrypts, strips the outer header, and forwards the inner packet on the internal network. Unlike site-to-site, the near end is one user/device — not a whole remote LAN.",
  },
];

export function RemoteAccessDiagram() {
  const [step, setStep] = useState(1);
  const active = RA_STEPS.find((s) => s.id === step) ?? RA_STEPS[0];
  const inner = {
    src: "10.8.0.2",
    srcNote: "VPN address on the laptop",
    dst: "10.1.0.8",
    dstNote: "internal server",
  };
  const tunnel = {
    outerSrc: "198.51.100.50",
    outerSrcNote: "laptop on the café network",
    outerDst: "203.0.113.1",
    outerDstNote: "corporate VPN gateway",
  };

  return (
    <figure className="tlsip-fig">
      <StepNav steps={RA_STEPS} step={step} setStep={setStep} />
      <div className="tlsip-s2s" aria-label="Remote-access VPN packet path">
        <div className={`tlsip-s2s-hop ${active.hop === "user" || active.hop === "wrap" ? "lit" : ""}`}>
          <strong>Remote user / device</strong>
          <small>198.51.100.50 · authenticates, then runs IPsec</small>
          <span className="tlsip-s2s-host">VPN client · inner 10.8.0.2 → 10.1.0.8</span>
        </div>
        <div className={`tlsip-tunnel ${active.hop === "wan" ? "lit" : ""}`}>
          <span className="tlsip-tunnel-label">Encrypted VPN tunnel</span>
          <span className="tlsip-tunnel-sub">Internet sees 198.51.100.50 → 203.0.113.1</span>
        </div>
        <div className={`tlsip-s2s-hop gw ${active.hop === "lan" ? "lit" : ""}`}>
          <strong>VPN Gateway</strong>
          <small>203.0.113.1 · ICV · decrypt · forward</small>
        </div>
        <div className="tlsip-v-arrow" aria-hidden="true">
          <span>▼</span>
        </div>
        <div className={`tlsip-s2s-hop ${active.hop === "lan" ? "lit" : ""}`}>
          <strong>Internal network</strong>
          <small>10.1.0.0/24 · plaintext LAN</small>
          <span className="tlsip-s2s-host">10.1.0.8 receives GET /secret</span>
        </div>
      </div>
      <StepCopy step={active} />
      {step === 1 ? <IkeAuthCard /> : null}
      {step === 2 ? <InnerClearPacket {...inner} /> : null}
      {step === 3 ? (
        <div className="tlsip-wire" aria-label="Device encapsulating toward the gateway">
          <p className="tlsip-wire-sep" style={{ marginTop: 0 }}>
            VPN client wraps the inner packet
          </p>
          <div className="tlsip-wire-box clear-ip">
            <p className="tlsip-wire-h">Inner IP</p>
            <p>
              Src: <code>10.8.0.2</code> → Dst: <code>10.1.0.8</code>
            </p>
          </div>
          <p className="tlsip-wire-sep">↓ tunnel-mode ESP</p>
          <div className="tlsip-wire-box outer">
            <p className="tlsip-wire-h">Outer IP</p>
            <p>
              Src: <code>198.51.100.50</code> → Dst: <code>203.0.113.1</code>
            </p>
          </div>
        </div>
      ) : null}
      {step === 4 ? <TunnelEspPacket {...tunnel} /> : null}
      {step === 5 ? (
        <>
          <TunnelEspPacket {...tunnel} />
          <p className="caption">Gateway decrypts and forwards on the LAN →</p>
          <InnerClearPacket {...inner} />
        </>
      ) : null}
      <figcaption>
        Remote-access: one device is the near IPsec peer. Site-to-site: a gateway speaks IPsec for a
        whole remote network.
      </figcaption>
    </figure>
  );
}
