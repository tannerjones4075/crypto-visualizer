import { useEffect } from "react";
import { StageHero } from "../components/StageVisuals.jsx";
import {
  HostToHostDiagram,
  IpsecCards,
  LayerStackDiagram,
  RemoteAccessDiagram,
  SiteToSiteDiagram,
  TlsHandshakeDiagram,
  VpnOnOffDiagram,
} from "../components/TlsIpsecDiagrams.jsx";

const TLS_CERT_COMMANDS = [
  {
    id: "tlsipsec-selfsigned-gen",
    title: "Generate a TLS server certificate",
    caption:
      "Self-signed classroom cert for tls.example — the kind of PEM a server can present in the handshake. No browser trusts this root. Private key stays in the container; Run prints the certificate.",
    commandText:
      'openssl req -x509 -newkey rsa:2048 -noenc -keyout server.key -days 365 \\\n  -subj "/CN=tls.example" -out server.crt',
    runBody: { part: "tlsipsec", variant: "selfsigned-gen", plaintext: "tls-cert" },
    applications: [
      "HTTPS / TLS servers present a certificate during the handshake (8.2)",
      "Self-signed is for labs; production uses a CA (7.1)",
    ],
  },
  {
    id: "tlsipsec-selfsigned-show",
    title: "Read the certificate fields",
    caption:
      "Subject, issuer, dates, serial — the same story as 7.1. Issuer equals subject because this cert signed itself.",
    commandText: "openssl x509 -in server.crt -noout -subject -issuer -dates -serial",
    runBody: { part: "tlsipsec", variant: "selfsigned-show", plaintext: "tls-cert" },
  },
];

function LayersPanel() {
  return (
    <section className="hs-panel">
      <StageHero subId="layers" />
      <h3>Where TLS and IPsec operate</h3>
      <p className="caption">
        Read the stack top-down. TLS and IPsec are drawn on the <strong>joins</strong> between
        layers — they are not extra OSI layers of their own.
      </p>
      <LayerStackDiagram />
      <p>
        TLS typically runs over <strong>TCP</strong> (HTTPS).
      </p>
      <p>
        IPsec can protect traffic <strong>without the application knowing</strong> encryption is
        happening. A browser using TLS still sees “HTTPS”; a host behind a site-to-site VPN may send
        ordinary IP while the gateway applies IPsec.
      </p>
      <p className="tlsip-callout">
        <strong>Key difference:</strong> TLS protects application communications, while IPsec
        protects IP traffic. Both can provide Confidentiality and Integrity — at different heights
        in the stack.
      </p>
    </section>
  );
}

function TlsPanel() {
  return (
    <section className="hs-panel">
      <StageHero subId="tls" />
      <h3>TLS</h3>
      <p className="caption">
        TLS protects an application conversation: Confidentiality, Integrity, and server
        authentication (7.1). Step through one HTTPS session — handshake first, then encrypted
        records.
      </p>
      <TlsHandshakeDiagram />
      <p>
        After the handshake, bulk encryption is <strong>symmetric</strong> (session keys) — the
        expensive public-key work is for setup, not every byte (6.3 / 6.4).
      </p>
      <p className="caption">
        Real world below generates a classroom self-signed TLS certificate (the PEM a server can
        present). A CA-signed leaf is 7.1.
      </p>
    </section>
  );
}

function IpsecPanel() {
  return (
    <section className="hs-panel">
      <StageHero subId="ipsec" />
      <h3>IPsec</h3>
      <p className="caption">
        IPsec is a <strong>suite</strong> at the IP layer: protect packets between hosts or
        gateways, even when the applications themselves never call “encrypt.”
      </p>
      <VpnOnOffDiagram />
      <IpsecCards />
      <p>
        <strong>Encapsulating Security Payload (ESP)</strong> is how most VPNs get Confidentiality.{" "}
        <strong>AH</strong> is the
        auth-only contrast. <strong>Internet Key Exchange (IKE / IKEv2)</strong> is how peers
        typically create a <strong>Security Association (SA)</strong> — the policy + keys for each
        direction — without sending those keys in the clear.
      </p>
      <p>
        <strong>Tunnel mode</strong> hides the original inner packet — natural for connecting
        networks. <strong>Transport mode</strong> leaves the original IP header in place — natural
        when two hosts already know each other’s addresses. The three VPN pictures in 8.3.1–8.3.3
        show who runs IPsec.
      </p>
      <p className="tlsip-pkt-note expose">
        <strong>Firewalls and transport mode:</strong> Encapsulating Security Payload (ESP) encrypts
        TCP, UDP, and the application
        bytes. A firewall on the path still sees the original IP addresses, but it cannot look
        inside the packet to inspect ports or traffic. Policy that depends on “this is HTTPS” or
        “block this application” has nothing readable to match.
      </p>
    </section>
  );
}

function SiteToSitePanel() {
  return (
    <section className="hs-panel">
      <StageHero subId="site-to-site" />
      <h3>Site-to-site VPN</h3>
      <p className="caption">
        Two networks talk securely across an untrusted network. The <strong>gateways</strong> are
        the IPsec peers. Step through one packet.
      </p>
      <SiteToSiteDiagram />
      <p>
        Called <strong>site-to-site</strong> because each <em>site</em> sits behind a gateway. Hosts
        keep sending ordinary IP; only the gateways encapsulate, encrypt, and authenticate.
      </p>
    </section>
  );
}

function HostToHostPanel() {
  return (
    <section className="hs-panel">
      <StageHero subId="host-to-host" />
      <h3>Host-to-host IPsec</h3>
      <p className="caption">
        Two hosts protect IP to each other. No site gateway. Step through one packet — usually
        transport mode.
      </p>
      <HostToHostDiagram />
      <p>
        Encryption lives on <strong>Host A</strong> and <strong>Host B</strong>. Other machines on
        the same LAN are not automatically in the tunnel.
      </p>
    </section>
  );
}

function RemoteAccessPanel() {
  return (
    <section className="hs-panel">
      <StageHero subId="remote-access" />
      <h3>Remote-access VPN</h3>
      <p className="caption">
        One user or device reaches the organization’s network from an untrusted place. Step through
        auth, wrap, path, and delivery.
      </p>
      <RemoteAccessDiagram />
      <p>
        Unlike site-to-site, the near IPsec peer is a <strong>person/device</strong>, not a remote
        LAN gateway.
      </p>
    </section>
  );
}

export default function TlsIpsecDemo({ subId, onRealWorldChange }) {
  useEffect(() => {
    if (subId === "tls") {
      onRealWorldChange?.(TLS_CERT_COMMANDS);
    } else {
      onRealWorldChange?.([]);
    }
  }, [subId, onRealWorldChange]);

  let panel = (
    <section className="hs-panel">
      <h3>Part 8 — {subId}</h3>
      <p className="caption">Unknown subsection.</p>
    </section>
  );
  if (subId === "layers") panel = <LayersPanel />;
  else if (subId === "tls") panel = <TlsPanel />;
  else if (subId === "ipsec") panel = <IpsecPanel />;
  else if (subId === "site-to-site") panel = <SiteToSitePanel />;
  else if (subId === "host-to-host") panel = <HostToHostPanel />;
  else if (subId === "remote-access") panel = <RemoteAccessPanel />;

  return <div className="tlsip-demo hs-demo">{panel}</div>;
}
