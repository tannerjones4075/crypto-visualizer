export const PART_ORDER = [
  "foundations",
  "rc4",
  "des",
  "tdes",
  "aes",
  "publickey",
  "trust",
  "tlsipsec",
];

export const PUBLICKEY_SUB_IDS = [
  "negotiation",
  "mutual-auth",
  "key-exchange",
  "ongoing",
  "signatures",
];

export const TRUST_SUB_IDS = [
  "certificates",
  "live-certificate",
  "validity",
  "hmac-lab",
  "non-repudiation",
];

export const TLSIPSEC_SUB_IDS = [
  "layers",
  "tls",
  "ipsec",
  "site-to-site",
  "host-to-host",
  "remote-access",
];


export const PARTS = [
  {
    id: "foundations",
    title: "Part 1 — Foundations",
    status: "concept",
    statusLabel: "Concepts",
    cia: {
      confidentiality: {
        tag: "serves (via encryption idea)",
        detail: "Encryption with a secret key serves Confidentiality. Encoding and hashing do not hide the message.",
      },
      integrity: {
        tag: "serves (via hashing)",
        detail: "A hash digest changes when the message changes — Integrity. Hashing is not Confidentiality.",
      },
      availability: {
        tag: "not this part",
        detail: "Availability is not the focus of Foundations.",
      },
    },
    teach: {
      definition:
        "Cryptography is the use of mathematical operations to protect messages traveling between parties or stored on a computer.",
      originalPurpose:
        "Encryption for Confidentiality was the original purpose of cryptography — keep the message secret from everyone except the intended partners.",
      kerckhoffs: {
        attribution: "Kerckhoffs’s principle",
        quote:
          "In order to have confidentiality, communication partners need to keep only the key secret, not the cipher.",
      },
      what: null,
      why: null,
      plaintext:
        "Plaintext is the original, readable message — data in a form humans or programs can understand without a secret key. It is what you start with before encryption, encoding, or hashing.",
      ciphertext:
        "Ciphertext is the protected form of a message after encryption. Without the correct key, ciphertext should be useless — you cannot recover the plaintext.",
      cipher:
        "A cipher is a specific mathematical process used in encryption and decryption.",
      key: "A key is a secret value that controls the cipher. Partners who share the key can encrypt and decrypt; without it, ciphertext should stay unreadable. Per Kerckhoffs, the key is what you keep secret — not the cipher itself.",
      advancedLink: null,
    },
    disclaimer:
      "These visualizations simplify real algorithms for class. They demonstrate concepts. They are not implementations for production use.",
    realWorldNote: "",
  },
  {
    id: "rc4",
    title: "Part 2 — RC4",
    status: "broken",
    statusLabel: "Broken / obsolete",
    ciaMode: "icons",
    cia: {
      confidentiality: {
        rating: "bad",
        tag: "fails in the real world",
        detail:
          "Confidentiality only if the keystream stays secret and is never reused. RC4 is broken — Confidentiality fails for real use. Educational only.",
      },
      integrity: {
        rating: "bad",
        tag: "does not serve",
        detail: "RC4 does not detect tampering. Integrity is not provided.",
      },
      availability: {
        rating: "na",
        tag: "not the lesson",
        detail: "Availability is not the focus of this part.",
      },
    },
    teach: {
      definition: null,
      originalPurpose: null,
      kerckhoffs: null,
      what: "RC4 is a stream cipher: the key expands into a keystream, then that keystream is mixed with the plaintext one byte at a time to make ciphertext. The same key runs the process again to decrypt.",
      why: "RC4 was once everywhere — TLS, Wi-Fi, everyday protocols. Speed and popularity are not security. It is obsolete; do not use it for real Confidentiality.",
      plaintext: null,
      cipher:
        "A stream cipher turns a key into a long run of keystream bytes, then mixes that stream with the message a byte at a time — no fixed block size like AES.",
      keystream:
        "A keystream is the byte sequence produced from the secret key. It is mixed (XOR) with the plaintext to make ciphertext. Keep it secret and never reuse it for two messages.",
      ciphertext: null,
      key: "One secret key. Anyone with the key can encrypt and decrypt. Wrong key → garbage. Never reuse the same keystream for two messages.",
      hex: null,
      xor: null,
      pros: [
        "Very fast — simple byte-stream mixing with little CPU work",
        "Low memory and processing needs — historically attractive for constrained devices",
        "Simple to implement and understand at a high level",
      ],
      cons: [
        "Cryptographically weak — practical attacks exist; Confidentiality fails in real use",
        "Key / keystream misuse is easy (reused streams, related-key problems)",
        "Key length does not save it — a longer key does not fix a broken stream cipher",
        "Obsolete — removed or disabled in modern TLS and many OpenSSL builds",
      ],
      advancedLink: null,
    },
    disclaimer:
      "RC4 is obsolete and broken. These visualizations are for class only — never use RC4 in production systems.",
    realWorldNote:
      "OpenSSL 3 hides RC4 unless the legacy provider is loaded (-provider legacy). That is part of the “obsolete” story — we enable it only so the classroom Run still works.",
    realWorldCaseStudy: {
      title: "Case study: WEP Wi-Fi",
      paragraphs: [
        {
          lead: null,
          text: "WEP (Wired Equivalent Privacy) was early Wi-Fi encryption. It used RC4 to hide packets between your laptop and the access point — a real deployment of the stream-cipher idea you just saw.",
        },
        {
          lead: "How it was built",
          text: "each packet got a short IV (initialization vector) stuck in front of a shared secret key. That combo fed RC4 to make a keystream, then the packet was XORed with the keystream. The IV was sent in the clear so the receiver could rebuild the same keystream.",
        },
        {
          lead: "How it failed",
          text: "the IV was only 24 bits, so values repeated. Related keys and reused keystreams let attackers recover the secret from enough captured traffic (classic FMS-style attacks and later tools). Confidentiality collapsed — not because “XOR is evil,” but because RC4 was keyed badly and keystreams were reused.",
        },
        {
          lead: "What replaced it",
          text: "WPA2 (and later WPA3) moved Wi-Fi to stronger designs (AES-based). Treat WEP as a museum piece: same lesson as this part — never reuse a keystream, and do not use RC4 for real systems.",
        },
      ],
    },
  },
  {
    id: "des",
    title: "Part 3 — DES",
    status: "broken",
    statusLabel: "Broken / obsolete",
    ciaMode: "icons",
    cia: {
      confidentiality: {
        rating: "bad",
        tag: "fails today (brute force)",
        detail:
          "DES served Confidentiality in the 1970s. A 56-bit effective key is too short now — Confidentiality fails to brute force.",
      },
      integrity: {
        rating: "bad",
        tag: "does not serve",
        detail: "DES does not detect tampering by itself. Integrity needs an HMAC or AEAD.",
      },
      availability: {
        rating: "na",
        tag: "not the lesson",
        detail: "Availability is not the focus of this part.",
      },
    },
    teach: {
      definition: null,
      originalPurpose: null,
      kerckhoffs: null,
      what: "DES is a block cipher: the plaintext is divided into 64-bit blocks and each block is encrypted in series. Inside every block, DES runs 16 rounds. The key is drawn as 64 bits, but only 56 bits are effective.",
      why: "DES was the standard for decades. Its short key is why we moved on — first to 3DES, then to AES. This part shows a real block cipher and why key length matters.",
      encryption:
        "Dividing a plaintext message into blocks and encrypting each block in series.",
      plaintext: null,
      cipher:
        "A block cipher cuts the message into fixed-size blocks (here 64 bits) and encrypts those blocks in series. Short final blocks are padded. Inside each block, DES runs 16 Feistel rounds.",
      key: "One secret key. Effective strength is 56 bits — far too small against modern attackers. Wrong key → garbage.",
      mode:
        "A mode is how a block cipher handles a whole message, not just one block. CBC (Cipher Block Chaining) mixes each plaintext block with the previous ciphertext before encrypting. The first block needs an IV (initialization vector) — we show all zeros so you can see it; do not reuse a fixed IV with the same key for real.",
      keystream: null,
      ciphertext: null,
      hex: null,
      xor: null,
      pros: [
        "Historically standardized and widely deployed",
        "Clear teaching model: blocks in series, rounds inside each block, padding",
        "Fast enough on old hardware of its era",
      ],
      cons: [
        "56-bit effective key — practical to brute-force today",
        "64-bit block size is small by modern standards",
        "Obsolete — do not use for real Confidentiality",
      ],
      advancedLink: "Feistel",
    },
    disclaimer:
      "DES is obsolete and broken for real use. These visualizations are for class only.",
    realWorldNote:
      "OpenSSL 3 may require the legacy provider for DES (-provider legacy), same story as RC4.",
  },
  {
    id: "tdes",
    title: "Part 4 — 3DES",
    status: "legacy",
    statusLabel: "Legacy / deprecated",
    ciaMode: "icons",
    cia: {
      confidentiality: {
        rating: "warn",
        tag: "stretched DES; legacy",
        detail:
          "3DES stretched DES’s Confidentiality by running EDE with two or three keys. It is deprecated — do not use for new systems.",
      },
      integrity: {
        rating: "bad",
        tag: "does not serve",
        detail: "3DES does not detect tampering by itself. Integrity needs an HMAC or AEAD.",
      },
      availability: {
        rating: "na",
        tag: "legacy interoperability",
        detail:
          "3DES lingered so old systems could keep talking (legacy interoperability) — not because it is a good modern choice.",
      },
    },
    teach: {
      definition: null,
      originalPurpose: null,
      kerckhoffs: null,
      what: "3DES (Triple DES) runs DES three times: Encrypt → Decrypt → Encrypt (EDE). With two or three keys it raised the effective key length after single DES became too weak.",
      why: "3DES bought time after DES’s 56-bit key failed. It is legacy now — AES replaced it. The middle Decrypt exists so that if all keys are equal, 3DES reduces to single DES (compatibility).",
      encryption:
        "Dividing a plaintext message into blocks and encrypting each block in series (here via EDE).",
      plaintext: null,
      cipher:
        "Same 64-bit blocks as DES, but each block goes through EDE: encrypt with K1, decrypt with K2, encrypt with K3 (2-key sets K3 = K1).",
      key: "Two or three secret keys (K1, K2, K3), each typed as text and turned into a DES-sized key. 2-key: about 112 bits effective (K3 = K1). 3-key: about 168 bits. Wrong keys → garbage.",
      mode:
        "A mode is how a block cipher handles a whole message, not just one block. CBC (Cipher Block Chaining) mixes each plaintext block with the previous ciphertext before encrypting. The first block needs an IV (initialization vector) — we show all zeros so you can see it; do not reuse a fixed IV with the same key for real.",
      keystream: null,
      ciphertext: null,
      hex: null,
      xor: null,
      pros: [
        "Raised strength over single DES without a brand-new cipher",
        "Compatibility path: equal keys behave like DES",
        "Widely deployed in older payment and enterprise systems",
      ],
      cons: [
        "Slow (three DES passes) and still a small 64-bit block",
        "Legacy / deprecated — not for new Confidentiality designs",
        "Replaced by AES for modern bulk encryption",
      ],
      advancedLink: null,
    },
    disclaimer:
      "3DES is legacy and deprecated for new systems. These visualizations are for class only.",
    realWorldNote:
      "OpenSSL Real-world uses a passphrase (-k), not the K1/K2/K3 hex fields. Legacy provider may be required (-provider legacy).",
  },
  {
    id: "aes",
    title: "Part 5 — AES",
    status: "current",
    statusLabel: "Current",
    ciaMode: "icons",
    cia: {
      confidentiality: {
        rating: "good",
        tag: "bulk data today",
        detail:
          "AES is how we get Confidentiality for bulk data today — when the key is long enough and used correctly.",
      },
      integrity: {
        rating: "bad",
        tag: "not automatic",
        detail:
          "AES alone does not detect tampering. Integrity needs an HMAC or AEAD — Part 6.4 shows message-by-message authentication after the handshake.",
      },
      availability: {
        rating: "na",
        tag: "not the lesson",
        detail: "Availability is not the focus of this part.",
      },
    },
    teach: {
      definition: null,
      originalPurpose: null,
      kerckhoffs: null,
      what: "AES is a block cipher: the plaintext is cut into 128-bit blocks. Key size chooses the round count — AES-128 → 10 rounds, AES-192 → 12, AES-256 → 14.",
      why: "AES replaced DES and 3DES for modern bulk encryption. It is the primary symmetric example on this path: longer keys, larger blocks, still one shared secret.",
      encryption:
        "Dividing a plaintext message into blocks and encrypting each block in series.",
      plaintext: null,
      cipher:
        "A block cipher with 128-bit blocks. Inside each block, AES repeats a round of add-key / scramble / mix. Round count follows the key size (10 / 12 / 14).",
      key: "One secret key: 128, 192, or 256 bits. Type a passphrase; we derive a key of the selected length. Wrong key → garbage.",
      mode:
        "A mode is how a block cipher handles a whole message, not just one block. CBC (Cipher Block Chaining) mixes each plaintext block with the previous ciphertext before encrypting. The first block needs an IV (initialization vector) — we show all zeros so you can see it; do not reuse a fixed IV with the same key for real. ECB would repeat identical plaintext blocks as identical ciphertext — dangerous; we use CBC.",
      keystream: null,
      ciphertext: null,
      hex: null,
      xor: null,
      pros: [
        "Current standard for bulk Confidentiality",
        "128-bit blocks and 128–256-bit keys",
        "Widely supported in hardware and OpenSSL",
      ],
      cons: [
        "Confidentiality only — Integrity needs HMAC or AEAD",
        "Misused IV / mode choices still break security",
        "Not a replacement for public-key or signatures",
      ],
      advancedLink: "MixColumns",
    },
    disclaimer:
      "These visualizations simplify AES for class. Prefer AEAD (e.g. AES-GCM) when Integrity also matters in real systems.",
    realWorldNote:
      "OpenSSL Real-world uses a passphrase (-k). The browser demo derives its own key from the same passphrase text — outputs may not match OpenSSL’s key derivation.",
  },
  {
    id: "publickey",
    title: "Part 6 — Public Key Encryption",
    status: "current",
    statusLabel: "Public-key path",
    disclaimer:
      "Part 6 demos use teaching-scale parameters and browser crypto. Not a TLS stack or production key exchange.",
    realWorldNote:
      "Real world commands are local OpenSSL only — no outbound TLS to arbitrary hosts.",
    subsections: [
      {
        id: "negotiation",
        label: "6.1",
        title: "Negotiation",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "na",
            tag: "suite chooses later C",
            detail: "Negotiation picks which algorithms will protect Confidentiality later.",
          },
          integrity: {
            rating: "na",
            tag: "suite chooses later I",
            detail: "The cipher suite also names integrity / auth mechanisms used after the handshake.",
          },
          availability: {
            rating: "na",
            tag: "failed negotiation → no session",
            detail: "If Alice and Bob cannot agree a suite, there is no session.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "Negotiation is how Alice (supplicant) and Bob (verifier) agree a cipher suite — which algorithms for confidentiality, integrity, authentication, and key exchange.",
          why: "Without an agreed suite, later encryption and authentication have no shared plan.",
          roles:
            "Supplicant (Alice) starts the session. Verifier (Bob) checks identity and agrees parameters.",
          plaintext: null,
          cipher:
            "DH + RSA: DH agrees the secret, RSA authenticates (and can wrap). ECDH + ECDSA: ECDH agrees the secret, ECDSA authenticates. AES encrypts bulk data either way.",
          key: "No session key yet — negotiation only chooses how a key will be made.",
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          leaveWith:
            "Compare DH + RSA vs ECDH + ECDSA: same security goal; different public-key family (key size and performance).",
          pros: [
            "DH + RSA: familiar modular DH + RSA signatures / wrap",
            "ECDH + ECDSA: smaller keys, generally more efficient",
          ],
          cons: [
            "DH + RSA: larger keys / heavier",
            "ECDH + ECDSA: needs a trusted curve; some legacy gear lags",
          ],
          advancedLink: null,
        },
        realWorldNote: "Local openssl ciphers -v for one named suite.",
      },
      {
        id: "mutual-auth",
        label: "6.2",
        title: "Mutual authentication",
        realWorldNote:
          "openssl genpkey / genrsa for key pairs; suite line names auth algorithms. Signature math deep dive is 6.5.",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "na",
            tag: "not this page",
            detail: "Mutual auth proves who is talking — it does not encrypt the message body.",
          },
          integrity: {
            rating: "good",
            tag: "peer authenticity",
            detail:
              "Electronic signatures bind identity to the handshake so an impostor is detected.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "Mutual authentication: Alice and Bob each prove who they are. Electronic signatures prove possession of a private key without giving it away.",
          why: "Without mutual auth, a later shared key might be negotiated with an impostor — Confidentiality to the wrong party.",
          roles: "Supplicant (Alice) ↔ Verifier (Bob). Each has a key pair; public keys can be known, private keys stay secret.",
          steps: [
            "Each side has a key pair: public can be shared; private never leaves its owner.",
            "Alice signs a handshake challenge / transcript with her private key and sends the signature (and her public identity) to Bob.",
            "Bob verifies with Alice’s public key. Fail → stop (wrong peer or tampered handshake).",
            "Bob signs; Alice verifies Bob the same way — that is the “mutual” part.",
            "Only after both checks succeed do they move on to key exchange (6.3).",
          ],
          plaintext: null,
          cipher: null,
          key: "Private keys stay secret; only signature proofs (and public keys) travel on the wire.",
          encryption:
            "Contrast: RSA encrypt (6.3) hides a small secret. Sign (here) proves identity — opposite use of the key pair.",
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: [
            "Stops impostors before a session key is trusted",
            "Works with RSA or ECC signature algorithms from the suite",
          ],
          cons: [
            "Needs a way to trust public keys (certificates / prior knowledge — simplified here)",
            "Signature math deep dive is on 6.5, not this page",
          ],
          advancedLink: null,
        },
      },
      {
        id: "key-exchange",
        label: "6.3",
        title: "Key exchange",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "good",
            tag: "shared secret → session key",
            detail:
              "Diffie–Hellman (or RSA wrap / ECDH) produces a shared key for bulk Confidentiality. Lose the RSA private key → lose wrapped secrets.",
          },
          integrity: {
            rating: "bad",
            tag: "not automatic",
            detail: "Key exchange alone does not authenticate later messages — that is 6.4 / 6.5.",
          },
          availability: {
            rating: "na",
            tag: "lost private key → lost data",
            detail: "For RSA wrap: lose the private key, lose the wrapped secret.",
          },
        },
        teach: {
          definition: {
            title: "What is mod?",
            body: [
              "mod means remainder after division — the wrap-around clock of numbers.",
              "Example: 17 mod 5 = 2, because 17 = 3×5 + 2.",
              "In Diffie–Hellman, “gᵃ mod p” means raise g to the power a, then take the remainder when divided by the prime p. That keeps numbers in a fixed range and is what makes the public value safe to share.",
            ],
          },
          originalPurpose: null,
          kerckhoffs: null,
          what: [
            "Goal: Alice and Bob end up with the same secret key — without ever sending that key across the network.",
            "That key is what AES later uses to encrypt real messages (6.4).",
            "Two common suites: DH + RSA, or ECDH + ECDSA. Same purpose; different asymmetric tech.",
            "DH/ECDH = key agreement. RSA/ECDSA = authenticate that exchange. AES = encrypt the data.",
          ],
          why: "Symmetric ciphers need a shared key without typing a password on the wire.",
          roles: "Alice and Bob each contribute; public values may travel in the clear.",
          steps: [
            "Alice and Bob each pick a secret number. Those secrets never leave their machines.",
            "From the secret, each makes a public value (using shared math parameters).",
            "They send only the public values to each other — safe if someone is listening.",
            "Each combines their own secret with the other’s public value and gets the same shared secret.",
            "Turn that shared secret into a session key; AES uses it to encrypt messages (6.4).",
          ],
          leaveWith:
            "RSA and ECC are alternative public-key technologies. DH/ECDH establishes a shared secret; RSA/ECDSA can authenticate that exchange; AES encrypts the data.",
          plaintext: null,
          cipher: [
            "DH or ECDH: agree the shared secret.",
            "RSA or ECDSA: authenticate / sign the exchange (optional RSA wrap of a tiny key).",
            "AES (Part 5 / 6.4): encrypts the real message with the session key.",
          ],
          key: "The session key usually comes from DH or ECDH. With RSA wrap, you can instead send a small AES key locked under the peer’s public key.",
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: null,
          cons: null,
          advancedLink: "Primes (RSA) · Elliptic curves (ECDH / ECDSA)",
        },
        realWorldNote:
          "Run in order: Alice key → Bob key → Bob public → derive shared secret (hex). Step 5 is the classroom KDF matching this page’s demo numbers.",
      },
      {
        id: "ongoing",
        label: "6.4",
        title: "Ongoing messages",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "good",
            tag: "session key encrypts",
            detail: "Each message can be encrypted with the session key from 6.3.",
          },
          integrity: {
            rating: "good",
            tag: "per-message HMAC / AEAD",
            detail:
              "Message-by-message authentication and integrity detect tampering (HMAC, or AEAD = Authenticated Encryption with Associated Data). Contrast with signatures in 6.5.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: {
            title: "What is an HMAC?",
            body: [
              "HMAC = Hash-based Message Authentication Code: a keyed fingerprint of a message using a shared secret (e.g. the session key) and a hash like SHA-256.",
              "Anyone who knows the same secret can make or check the same HMAC. That proves “this came from someone with the session key” — message-by-message auth + integrity.",
              "Contrast: a digital signature (6.5) uses a private key to sign and a public key to verify. HMAC ≠ signature.",
            ],
          },
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "After the handshake, every message needs confidentiality, message-by-message authentication, and integrity. Symmetric crypto (AES) encrypts the actual data with the session key from 6.3. If mutual auth (6.2) was skipped, a MITM can sit between Alice and Bob — encryption then protects the wrong peer.",
          why: "A shared key alone is not enough — you still must detect tampering and know the peer sent this message. Mutual auth stops Eve before you trust the session key.",
          roles: "Alice sends; Bob verifies tag / opens ciphertext. Eve appears only in the “skipped 6.2” MITM storyboard step.",
          steps: [
            "Session key ready from Diffie–Hellman (6.3).",
            "Encrypt with AES — Confidentiality for the message body.",
            "Attach an HMAC / AEAD tag — message-by-message authentication and integrity.",
            "Bob verifies the tag and opens — happy path OK.",
            "If mutual auth (6.2) was skipped: MITM — Eve can sit between Alice and Bob; encryption protects the wrong peer.",
          ],
          plaintext: null,
          cipher:
            "AES-GCM in the demo is AEAD (tag with the ciphertext). Separately, the demo also shows an HMAC-SHA-256 over the plaintext with the session key — same idea as a classic encrypt-then-MAC story. Contrast with signatures in 6.5.",
          key: "Uses the session key derived in 6.3.",
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: ["Makes CIA failures visible (wrong key / stripped tag)"],
          cons: ["Not a full protocol record layer"],
          advancedLink: null,
        },
        realWorldNote:
          "Optional local suite reminder. Message encrypt / HMAC lives in the browser demo (plus AEAD-style seal).",
      },
      {
        id: "signatures",
        label: "6.5",
        title: "Digital signatures",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "bad",
            tag: "does not hide the message",
            detail: "Signatures are not Confidentiality — the message can stay readable.",
          },
          integrity: {
            rating: "good",
            tag: "tamper fails · authenticity",
            detail:
              "Changing one letter makes verification fail. Authenticity (and non-repudiation in policy language) is tied to the private key.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "Digital signatures flip the RSA encrypt direction: sign with private, verify with public.",
          why: "Prove origin and integrity without encrypting the message. Used in mutual auth (6.2) and sometimes on chosen messages.",
          roles: "Sender (e.g. Alice) signs; anyone with the public key verifies.",
          leaveWith:
            "Hash-then-sign: signature is over a fingerprint (SHA-256), same idea as Part 1.",
          steps: [
            "Message ready — stays readable (not Confidentiality).",
            "Fingerprint the message with SHA-256.",
            "Sign the fingerprint with the private key.",
            "Anyone verifies with the public key → valid.",
            "Change one letter → verify fails (Integrity + authenticity).",
          ],
          plaintext: null,
          cipher: null,
          key: "Private key signs; public key verifies.",
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: ["Integrity + authenticity", "Clear contrast with encryption"],
          cons: ["Not Confidentiality"],
          advancedLink: "Elliptic curves (ECDSA)",
        },
        realWorldNote:
          "Fingerprint first: openssl dgst -sha256. Then genpkey / genrsa for key pairs; dgst -sha256 -sign / -verify when sign/verify is wired.",
      },
    ],
  },
  {
    id: "trust",
    title: "Part 7 — Certificates & HMAC",
    status: "current",
    statusLabel: "Trust & integrity",
    disclaimer:
      "Part 7 uses a fixed live certificate fetch with an offline fallback and browser HMAC. Not a PKI browser or production MAC library.",
    realWorldNote:
      "Real world commands are locked OpenSSL templates. Only 7.2 permits outbound TLS, fixed to www.google.com:443.",
    subsections: [
      {
        id: "certificates",
        label: "7.1",
        title: "Certificates & CAs",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "bad",
            tag: "not this page",
            detail: "Certificates bind identity to a public key — they do not encrypt the message.",
          },
          integrity: {
            rating: "good",
            tag: "authenticity of public keys",
            detail: "A CA signature authenticates that this identity is bound to this public key.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what: [
            "A certificate is a CA-signed binding of identity → public key.",
            "Part 6 gave you public keys but no way to know whose key you hold; a certificate answers that.",
            "Follow the trust story on the right, then inspect the standard fields.",
          ],
          why:
            "Without a trusted binding, anyone could claim any public key — including an impostor sitting in the middle of your handshake (6.2).",
          roles:
            "The CA vouches; the subject owns the public key; the browser verifies before it trusts.",
          steps: [
            "CA checks identity — it verifies who controls the name.",
            "CA signs the certificate — identity, public key, and dates signed as one binding (6.5).",
            "Browser trusts the key — it checks that signature with a CA public key it already holds; fail means stop.",
            "Read the field table — each row is something you inspect on a real cert.",
            "Real world: run the same moments against a local toy CA — generate, check the claimed name, sign, verify.",
            "Open 7.2 to inspect the current www.google.com leaf.",
          ],
          leaveWith:
            "A certificate is a CA-signed binding of identity → public key; these fields are what you inspect.",
          plaintext: null,
          cipher: null,
          key: "The subject’s public key is inside the cert; the CA’s private key made the signature.",
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: null,
          cons: null,
          advancedLink: null,
        },
        realWorldNote:
          "Local toy CA walkthrough: generate → check the claimed name → sign → verify. Classroom root only — no browser trusts it, and nothing leaves the container (live TLS is 7.2).",
      },
      {
        id: "live-certificate",
        label: "7.2",
        title: "Live certificate (www.google.com)",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "bad",
            tag: "not this page",
            detail: "The certificate identifies a public key; it does not encrypt this lesson.",
          },
          integrity: {
            rating: "good",
            tag: "inspect the signed binding",
            detail: "The live leaf exposes the identity, key, validity, extensions, and CA signature.",
          },
          availability: {
            rating: "na",
            tag: "snapshot fallback",
            detail: "A bundled leaf keeps the classroom usable if the live fetch is unavailable.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what: "Fetch and inspect the current leaf certificate presented by www.google.com.",
          why: "Certificate fields become concrete when you compare the table in 7.1 with a live site.",
          roles: null,
          steps: [
            "The server runs one fixed s_client command against www.google.com:443.",
            "It extracts the first leaf PEM and parses the same 11 classroom fields.",
            "If the network fails, the browser viewer labels and uses the bundled snapshot.",
          ],
          leaveWith: "A live certificate carries the same identity → public key binding and inspectable fields from 7.1.",
          plaintext: null,
          cipher: null,
          key: "Current subject public key from the fetched leaf.",
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: null,
          cons: null,
          advancedLink: null,
        },
        realWorldNote: "Fixed target only: openssl s_client to www.google.com:443; bundled leaf fallback stays offline.",
      },
      {
        id: "validity",
        label: "7.3",
        title: "Validity & revocation",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "bad",
            tag: "not this page",
            detail: "Validity and revocation are about trust freshness — not message secrecy.",
          },
          integrity: {
            rating: "good",
            tag: "freshness of trust",
            detail: "Expired or revoked certs must not be trusted even if fields otherwise look fine.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "Trust has an expiry (NotBefore → NotAfter). Revocation covers “still within dates but no longer trusted.”",
          why: "A stolen private key or mis-issued cert must be stoppable before NotAfter.",
          roles: null,
          steps: [
            "Read the certificate’s NotBefore and NotAfter dates.",
            "Now is still within the validity window, so the date check passes.",
            "The CA revokes early after a key compromise or identity change.",
            "A revocation-status check overrides the dates and rejects the certificate.",
          ],
          leaveWith:
            "Trust has an expiry; revocation covers “still within dates but no longer trusted.”",
          plaintext: null,
          cipher: null,
          key: null,
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: null,
          cons: null,
          advancedLink: null,
        },
        realWorldNote:
          "Canned local toy CA: verify the leaf, revoke it, generate a CRL, then verify with -crl_check and observe the expected failure. OCSP stays explain-only.",
      },
      {
        id: "hmac-lab",
        label: "7.4",
        title: "HMAC lab",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "bad",
            tag: "not shown (→ 6.4)",
            detail: "HMAC authenticates; confidentiality of the body is a separate encrypt step (Part 6.4).",
          },
          integrity: {
            rating: "good",
            tag: "integrity + message auth",
            detail: "Recompute HMAC and compare — tamper or wrong key → reject.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: {
            title: "What is an HMAC? (lab)",
            body: [
              "HMAC = Hash-based Message Authentication Code: shared key + message → tag (here SHA-256).",
              "Hash, not encryption — the tag does not hide the plaintext.",
              "HMAC ≠ non-repudiation (shared secret) — that contrast is 7.5 / signatures in 6.5.",
            ],
          },
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "Signatures are too heavy per packet → create/test HMAC. Interactive storyboard matching textbook Figure 3-23 steps 1–7.",
          why: "After key negotiation you still need cheap per-message integrity and authentication.",
          roles: "Sender attaches HMAC; receiver recomputes and compares.",
          steps: [
            "1–2: Shared key + plaintext → HMAC (SHA-256). Caption: hash, not encryption.",
            "3: Append → form [HMAC ‖ plaintext].",
            "4: Transmit (caption only — confidentiality not shown; see 6.4).",
            "5–7: Receiver recomputes HMAC, compares → authenticated / reject.",
          ],
          leaveWith:
            "Don’t sign every packet — HMAC with a negotiated key authenticates/integrity-checks messages (figure steps 1–7).",
          plaintext: null,
          cipher: null,
          key: "HMAC key from negotiation ≠ bulk encryption key.",
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: ["Fast per-message auth with a shared secret"],
          cons: ["Not non-repudiation — either party with the secret can make the tag"],
          advancedLink: null,
        },
        realWorldNote: "openssl dgst -sha256 -hmac <key> (stdin = message).",
      },
      {
        id: "non-repudiation",
        label: "7.5",
        title: "Non-repudiation",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "bad",
            tag: "not this page",
            detail: "Neither HMAC nor signatures are Confidentiality by themselves.",
          },
          integrity: {
            rating: "good",
            tag: "both can detect tamper",
            detail: "Both HMAC and signatures fail verify on tamper — the difference is who could have produced the tag.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "Signatures can support non-repudiation; HMAC cannot, because the secret is shared.",
          why: "Ask: who could have produced this tag?",
          roles: null,
          steps: [
            "HMAC: either party with the shared secret (or anyone who stole it) → no non-repudiation.",
            "Signature: only the private-key holder → can support non-repudiation (builds on 6.5).",
          ],
          leaveWith:
            "Non-repudiation needs a private-key signature; a shared-secret HMAC cannot provide it.",
          plaintext: null,
          cipher: null,
          key: null,
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: null,
          cons: null,
          advancedLink: null,
        },
        realWorldNote: "Explain-only contrast; signature CLI remains on 6.5.",
      },
    ],
  },
  {
    id: "tlsipsec",
    title: "Part 8 — TLS and IPsec",
    status: "current",
    statusLabel: "Protocols",
    disclaimer:
      "Part 8 diagrams simplify TLS and IPsec for class. They show where each protocol sits and how traffic is protected — not a full handshake or VPN implementation.",
    realWorldNote:
      "Most of Part 8 is explain-only. 8.2 can generate a classroom self-signed TLS certificate. CA walkthrough and live TLS stay on 7.1 / 7.2.",
    subsections: [
      {
        id: "layers",
        label: "8.1",
        title: "Where they operate",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "good",
            tag: "both can hide data",
            detail: "TLS and IPsec can both encrypt — they just wrap different things.",
          },
          integrity: {
            rating: "good",
            tag: "both can detect tamper",
            detail: "Both can authenticate and integrity-check traffic at their layer.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: {
            attribution: "Key difference",
            quote: "TLS protects application communications, while IPsec protects IP traffic.",
          },
          what: [
            "TLS sits above the transport layer. It usually wraps application data that already has a TCP path.",
            "IPsec sits at the IP / network layer. It protects IP packets, often before an application even sees the network.",
            "Do not flatten this to “TLS = transport layer” or “IPsec = network layer.” Each protocol attaches at a point in the stack; it is not a replacement OSI layer.",
          ],
          why:
            "Same CIA goals (Confidentiality + Integrity) can be delivered at different heights. Where you apply crypto changes what is visible on the wire and who must participate.",
          roles: null,
          steps: [
            "Start at the application — browsers, mail, APIs.",
            "TLS typically protects that conversation before (or as) it is handed to TCP.",
            "IPsec wraps or authenticates IP packets. Hosts or gateways can do this without the application knowing encryption is happening.",
            "Both can provide Confidentiality and Integrity — at different points.",
          ],
          leaveWith:
            "TLS protects application communications (usually over TCP). IPsec protects IP traffic. Same goals, different place in the stack.",
          plaintext: null,
          cipher: null,
          key: null,
          encryption: null,
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: null,
          cons: null,
          advancedLink: null,
        },
        realWorldNote:
          "Explain-only stack picture. Live certificate fetch stays on 7.2.",
      },
      {
        id: "tls",
        label: "8.2",
        title: "TLS",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "good",
            tag: "session encryption",
            detail: "After the handshake, symmetric keys encrypt application data (AES in 6.4 / Part 5).",
          },
          integrity: {
            rating: "good",
            tag: "auth + integrity",
            detail: "Certificates authenticate the server (7.1). Records also carry integrity (MAC / AEAD).",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: {
            title: "What is TLS?",
            body:
              "TLS (Transport Layer Security) is a protocol that protects an application conversation — HTTPS is the familiar case — using a handshake, then fast symmetric crypto.",
          },
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "TLS solves “I am talking to the right server, and nobody in the middle can read or quietly change this session.” It is not itself TCP, even though it usually runs over TCP.",
          why:
            "The open internet is untrusted. TLS gives Confidentiality, Integrity, and authentication of the server (and optionally the client) for that application session.",
          roles: "Client (browser or app) and server. A CA (7.1) vouches for the server’s public key.",
          steps: [
            "ClientHello — the client says hello in the clear over TCP: which TLS versions and ciphers it supports. IP addresses and port 443 stay visible.",
            "ServerHello + Certificate — the server picks a cipher and sends a CA-signed certificate so the client knows who it is talking to (7.1).",
            "Key exchange — public numbers go on the wire. Private keys never do (6.3).",
            "Session keys — both sides compute the same keys locally. Those keys are not sent. A Finished message proves they match.",
            "Encrypted application data — TLS hides HTTP. It does not hide IP addresses the way an IPsec tunnel can.",
          ],
          leaveWith:
            "Handshake first (hello, certificate, key exchange), then session keys encrypt the application data. Certificates answer “whose key is this?”",
          plaintext: null,
          cipher: null,
          key: "Handshake uses public-key / DH-style crypto; the session then uses symmetric keys.",
          encryption: "Symmetric encryption after the handshake — Confidentiality of the application bytes.",
          mode: null,
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: ["Protects the application conversation without changing IP routing"],
          cons: ["Does not hide IP addresses, ports, or that a TCP session exists"],
          advancedLink: null,
        },
        realWorldNote:
          "Locked OpenSSL templates. Generate a classroom self-signed TLS server certificate — the CA-signed walkthrough stays on 7.1; live fetch stays on 7.2.",
      },
      {
        id: "ipsec",
        label: "8.3",
        title: "IPsec",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "good",
            tag: "ESP can encrypt",
            detail: "Encapsulating Security Payload (ESP) can encrypt IP payload or a whole inner packet.",
          },
          integrity: {
            rating: "good",
            tag: "ESP / AH authenticate",
            detail: "ESP and AH authenticate with an Integrity Check Value (ICV) — a fingerprint on the packet. AH authenticates but does not encrypt.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: {
            title: "What is IPsec?",
            body:
              "IPsec is a suite of protocols that protect IP packets at the network layer — encryption, authentication, or both — between hosts or gateways.",
          },
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "IPsec solves “this IP traffic should stay confidential and unmodified even if it crosses an untrusted network,” without requiring every application to implement TLS.",
          why:
            "Site networks, host pairs, and remote users often need a blanket for all IP, not one TLS session per app.",
          roles: "Peers (hosts or VPN gateways) share a Security Association (SA). Internet Key Exchange (IKE / IKEv2) is how they usually agree keys and policy.",
          steps: [
            "Encapsulating Security Payload (ESP) encrypts packet contents, and can also authenticate them. Most VPNs use ESP.",
            "Authentication Header (AH) checks that a packet was not changed. It does not encrypt.",
            "A Security Association (SA) is the agreed policy and keys for one direction of traffic.",
            "Internet Key Exchange (IKE / IKEv2) sets up those SAs. Tunnel mode wraps the whole original packet. Transport mode encrypts the payload and leaves the original IP header in place.",
            "In transport mode a firewall cannot look inside the packet — it only sees ESP — so it cannot inspect ports or application traffic.",
          ],
          leaveWith:
            "IPsec protects IP. Encapsulating Security Payload (ESP) for encryption; AH for auth-only; Internet Key Exchange (IKE) sets up a Security Association (SA); tunnel vs transport changes what gets wrapped. Transport-mode ESP also blinds firewalls that need to look inside the packet.",
          plaintext: null,
          cipher: null,
          key: "Security Association (SA) keys, usually from Internet Key Exchange version 2 (IKEv2) — not an application password.",
          encryption: "Encapsulating Security Payload (ESP): Confidentiality of IP payload (transport) or the whole inner packet (tunnel).",
          mode: "Tunnel mode vs transport mode — see the cards on the right, then 8.3.1–8.3.3. Transport mode is hard on firewalls: they cannot inspect encrypted payload.",
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: ["Application-unaware protection of IP"],
          cons: [
            "Does not, by itself, authenticate a web server the way a TLS certificate does",
            "Transport mode hides ports and payload from firewalls that need to inspect inside the packet",
          ],
          advancedLink: null,
        },
        realWorldNote: "Explain-only. No IPsec CLI in this classroom image.",
      },
      {
        id: "site-to-site",
        label: "8.3.1",
        title: "Site-to-site VPN",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "good",
            tag: "tunnel hides inner packets",
            detail: "Gateways encapsulate site traffic so the internet sees an IPsec tunnel, not the inner LAN packets in the clear.",
          },
          integrity: {
            rating: "good",
            tag: "tunnel authenticates",
            detail: "The Security Association (SA) authenticates the tunnel so a forged outer packet is rejected.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "Two networks (sites) send traffic through VPN gateways that encrypt across an untrusted path such as the internet.",
          why: "Branch offices need to look like one private network without trusting every hop in between.",
          roles: "Hosts on Network A/B stay ordinary. The gateways speak IPsec.",
          steps: [
            "A host on Network A sends a normal inner IP packet toward Network B.",
            "Gateway A matches a Security Association (SA) — IKE already ran — wraps the whole packet in tunnel-mode ESP, and adds outer gateway IPs.",
            "The internet sees only gateway-to-gateway ESP. Inner addresses and payload stay encrypted.",
            "Gateway B checks the Integrity Check Value (ICV) — a fingerprint that proves the packet was not altered — then decrypts, strips the outer header, and forwards the original packet on Network B.",
            "That is site-to-site: whole sites sit behind the gateways. Hosts need not run IPsec.",
          ],
          leaveWith:
            "Site-to-site: gateways tunnel for entire networks. Hosts on each LAN need not run IPsec themselves.",
          plaintext: null,
          cipher: null,
          key: "SAs between gateways (IKE).",
          encryption: "At the gateway — inner packet in, encrypted outer packet out.",
          mode: "Typically tunnel mode.",
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: null,
          cons: null,
          advancedLink: null,
        },
        realWorldNote: "Explain-only site-to-site picture.",
      },
      {
        id: "host-to-host",
        label: "8.3.2",
        title: "Host-to-host IPsec",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "good",
            tag: "hosts encrypt IP",
            detail: "Each host applies IPsec to packets it sends to the peer.",
          },
          integrity: {
            rating: "good",
            tag: "hosts authenticate IP",
            detail: "The Security Association (SA) is between the two hosts, not a pair of site gateways.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "Two individual machines protect IP traffic to each other with IPsec on the hosts themselves.",
          why: "Sometimes you need a secure path between two computers without building a site VPN.",
          roles: "Host A and Host B are the IPsec peers.",
          steps: [
            "An application on Host A builds a normal packet to Host B.",
            "Host A’s IPsec stack matches a Security Association (SA) and applies transport-mode ESP: original IP header stays; TCP and data are encrypted.",
            "The path still sees both hosts’ real IP addresses — it cannot read the payload. Other LAN neighbors are not in this SA.",
            "Host B checks the Integrity Check Value (ICV), decrypts, and delivers TCP/data to the application. No site gateway sat in the middle.",
          ],
          leaveWith:
            "Host-to-host: the endpoints run IPsec. Site-to-site: the gateways run IPsec for whole networks.",
          plaintext: null,
          cipher: null,
          key: "SAs between the two hosts.",
          encryption: "On Host A and Host B.",
          mode: "Often transport mode (original IP header stays), though tunnel mode is possible.",
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: null,
          cons: null,
          advancedLink: null,
        },
        realWorldNote: "Explain-only host-to-host picture.",
      },
      {
        id: "remote-access",
        label: "8.3.3",
        title: "Remote-access VPN",
        ciaMode: "icons",
        cia: {
          confidentiality: {
            rating: "good",
            tag: "user tunnel",
            detail: "The remote device encrypts traffic to the organization’s VPN gateway.",
          },
          integrity: {
            rating: "good",
            tag: "user + device auth",
            detail: "The user/device is authenticated before the tunnel carries internal traffic.",
          },
          availability: {
            rating: "na",
            tag: "not the lesson",
            detail: "Availability is not the focus.",
          },
        },
        teach: {
          definition: null,
          originalPurpose: null,
          kerckhoffs: null,
          what:
            "One user or device on an untrusted network (home, café, hotel) builds an encrypted VPN tunnel into the organization’s network.",
          why: "Staff need internal resources without sitting on the office LAN.",
          roles: "Remote user/device, VPN gateway, internal hosts behind the gateway.",
          steps: [
            "Authenticate the user/device. IKE/IKEv2 builds a Security Association (SA) with the VPN gateway — no application data yet.",
            "The device builds an inner packet toward an internal host, often from a VPN-assigned address.",
            "The VPN client encapsulates that packet in tunnel-mode ESP. Outer IPs are the laptop and the corporate gateway.",
            "The untrusted path sees only laptop → gateway plus ESP.",
            "The gateway checks the Integrity Check Value (ICV), decrypts, and forwards on the internal LAN. Unlike site-to-site, the near end is one device, not a whole remote network.",
          ],
          leaveWith:
            "Remote-access: user/device ↔ gateway. Site-to-site: network ↔ network via two gateways.",
          plaintext: null,
          cipher: null,
          key: "Security Association (SA) between the remote device and the gateway, after user/device authentication.",
          encryption: "On the remote device and the VPN gateway.",
          mode: "Typically tunnel mode toward the gateway.",
          keystream: null,
          ciphertext: null,
          hex: null,
          xor: null,
          pros: null,
          cons: null,
          advancedLink: null,
        },
        realWorldNote: "Explain-only remote-access picture.",
      },
    ],
  },
];

export function getPart(id) {
  return PARTS.find((p) => p.id === id) ?? PARTS[0];
}

export function getSubsection(part, subId) {
  if (!part?.subsections?.length) return null;
  return part.subsections.find((s) => s.id === subId) ?? part.subsections[0];
}

/** Merge chapter + active subsection for Shell teach/CIA/header. */
export function resolveLesson(partId, subId) {
  const part = getPart(partId);
  const sub = getSubsection(part, subId);
  if (!sub) {
    return { part, sub: null, display: part };
  }
  return {
    part,
    sub,
    display: {
      ...part,
      title: `${sub.label} — ${sub.title}`,
      statusLabel: sub.title,
      cia: sub.cia,
      ciaMode: sub.ciaMode || part.ciaMode || "icons",
      teach: sub.teach,
      disclaimer: sub.disclaimer || part.disclaimer,
      realWorldNote: sub.realWorldNote || part.realWorldNote,
    },
  };
}
