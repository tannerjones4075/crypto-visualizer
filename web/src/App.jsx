import { useCallback, useEffect, useState } from "react";
import AdvancedTopic from "./components/AdvancedTopic.jsx";
import EncryptionCore from "./components/EncryptionCore.jsx";
import FeistelAdvanced from "./components/FeistelAdvanced.jsx";
import How3DESRuns from "./components/How3DESRuns.jsx";
import HowDESRuns from "./components/HowDESRuns.jsx";
import MixColumnsAdvanced from "./components/MixColumnsAdvanced.jsx";
import RsaWrapOptional from "./components/RsaWrapOptional.jsx";
import Shell from "./components/Shell.jsx";
import AESDemo from "./demos/AESDemo.jsx";
import DESDemo from "./demos/DESDemo.jsx";
import FoundationsDemo, { FOUNDATIONS_DEFAULT_PLAINTEXT } from "./demos/FoundationsDemo.jsx";
import PublicKeyDemo from "./demos/PublicKeyDemo.jsx";
import RC4Demo from "./demos/RC4Demo.jsx";
import TripleDESDemo from "./demos/TripleDESDemo.jsx";
import TrustAuthDemo from "./demos/TrustAuthDemo.jsx";
import { runOpenSSL } from "./lib/api.js";
import { PARTS, PUBLICKEY_SUB_IDS, TRUST_SUB_IDS, resolveLesson } from "./parts.js";

function subIdsFor(partId) {
  if (partId === "publickey") return PUBLICKEY_SUB_IDS;
  if (partId === "trust") return TRUST_SUB_IDS;
  return [];
}

export default function App() {
  const [partId, setPartId] = useState("foundations");
  const [subId, setSubId] = useState(PUBLICKEY_SUB_IDS[0]);
  const [plaintext, setPlaintext] = useState(FOUNDATIONS_DEFAULT_PLAINTEXT);
  const [commands, setCommands] = useState([]);
  const [results, setResults] = useState([]);
  const [runningId, setRunningId] = useState(null);
  const [advancedMeta, setAdvancedMeta] = useState(null);
  const [desPipeline, setDesPipeline] = useState(null);
  const [tdesPipeline, setTdesPipeline] = useState(null);
  const [kxMethod, setKxMethod] = useState("dh-rsa");

  const { part: chapter, display } = resolveLesson(partId, subId);
  const hasSubs = Boolean(chapter.subsections?.length);

  const onRealWorldChange = useCallback((nextCommands) => {
    setCommands(nextCommands);
  }, []);

  const onAdvancedMeta = useCallback((meta) => {
    setAdvancedMeta(meta);
  }, []);

  const onPipelineMeta = useCallback((meta) => {
    setTdesPipeline(meta);
  }, []);

  const onDesPipelineMeta = useCallback((meta) => {
    setDesPipeline(meta);
  }, []);

  const onKxMethodChange = useCallback((method) => {
    setKxMethod(method);
  }, []);

  useEffect(() => {
    // Do not clear commands here — child demos set them in their own effects, which
    // run before this parent effect. Clearing would wipe the just-set Real world strip.
    setResults([]);
    setRunningId(null);
    setAdvancedMeta(null);
    setDesPipeline(null);
    setTdesPipeline(null);
    if (partId !== "publickey") {
      setKxMethod("dh-rsa");
    }
  }, [partId, subId]);

  function onSelectPart(id) {
    setPartId(id);
    const subs = subIdsFor(id);
    if (subs.length) setSubId(subs[0]);
  }

  function onSelectSub(id) {
    setSubId(id);
  }

  function goBack() {
    const idx = PARTS.findIndex((p) => p.id === partId);
    const subs = subIdsFor(partId);
    const si = subs.indexOf(subId);
    if (subs.length && si > 0) {
      setSubId(subs[si - 1]);
      return;
    }
    if (idx > 0) {
      const prev = PARTS[idx - 1];
      setPartId(prev.id);
      const prevSubs = subIdsFor(prev.id);
      if (prevSubs.length) setSubId(prevSubs[prevSubs.length - 1]);
    }
  }

  function goNext() {
    const idx = PARTS.findIndex((p) => p.id === partId);
    const subs = subIdsFor(partId);
    const si = subs.indexOf(subId);
    if (subs.length && si >= 0 && si < subs.length - 1) {
      setSubId(subs[si + 1]);
      return;
    }
    if (idx >= 0 && idx < PARTS.length - 1) {
      const next = PARTS[idx + 1];
      setPartId(next.id);
      const nextSubs = subIdsFor(next.id);
      if (nextSubs.length) setSubId(nextSubs[0]);
    }
  }

  const partIndex = PARTS.findIndex((p) => p.id === partId);
  const chapterSubs = subIdsFor(partId);
  const subIndex = chapterSubs.indexOf(subId);
  const canBack = partIndex > 0 || subIndex > 0;
  const canNext =
    partIndex < PARTS.length - 1 ||
    (chapterSubs.length > 0 && subIndex >= 0 && subIndex < chapterSubs.length - 1);

  async function onRun(cmd) {
    if (!cmd?.runBody) return;
    setRunningId(cmd.id);
    try {
      const data = await runOpenSSL(cmd.runBody);
      const stderr = (data.stderr ?? "").trim();
      setResults((prev) => {
        const entry = {
          id: cmd.id,
          stdout: data.stdout ?? "",
          error: data.error || (!data.stdout && stderr ? stderr : undefined),
        };
        return [entry, ...prev.filter((r) => r.id !== cmd.id)];
      });
    } catch (err) {
      setResults((prev) => [
        { id: cmd.id, stdout: "", error: err.message },
        ...prev.filter((r) => r.id !== cmd.id),
      ]);
    } finally {
      setRunningId(null);
    }
  }

  return (
    <Shell
      parts={PARTS}
      currentId={partId}
      onSelect={onSelectPart}
      part={display}
      chapterTitle={hasSubs ? chapter.title : null}
      subsections={hasSubs ? chapter.subsections : null}
      currentSubId={subId}
      onSelectSub={onSelectSub}
      onBack={goBack}
      onNext={goNext}
      canBack={canBack}
      canNext={canNext}
      realWorld={{
        commands,
        onRun,
        results,
        runningId,
      }}
      beforeRealWorld={
        partId === "foundations" ? (
          <EncryptionCore />
        ) : partId === "des" && desPipeline ? (
          <HowDESRuns {...desPipeline} />
        ) : partId === "tdes" && tdesPipeline ? (
          <How3DESRuns {...tdesPipeline} />
        ) : null
      }
      optionalBand={
        partId === "publickey" && subId === "key-exchange" && kxMethod === "dh-rsa" ? (
          <RsaWrapOptional plaintext={plaintext} setPlaintext={setPlaintext} />
        ) : null
      }
      advanced={
        partId === "rc4" && advancedMeta ? (
          <AdvancedTopic
            plaintext={advancedMeta.plaintext}
            keyHex={advancedMeta.keyHex}
            passphrase={advancedMeta.passphrase}
          />
        ) : partId === "des" ? (
          <FeistelAdvanced plaintext={plaintext} />
        ) : partId === "aes" ? (
          <MixColumnsAdvanced plaintext={plaintext} />
        ) : null
      }
    >
      {partId === "foundations" ? (
        <FoundationsDemo
          plaintext={plaintext}
          setPlaintext={setPlaintext}
          onRealWorldChange={onRealWorldChange}
        />
      ) : partId === "rc4" ? (
        <RC4Demo
          plaintext={plaintext}
          setPlaintext={setPlaintext}
          onRealWorldChange={onRealWorldChange}
          onAdvancedMeta={onAdvancedMeta}
          rwEncryptStdout={results.find((r) => r.id === "rc4-encrypt")?.stdout}
        />
      ) : partId === "des" ? (
        <DESDemo
          plaintext={plaintext}
          setPlaintext={setPlaintext}
          onRealWorldChange={onRealWorldChange}
          onPipelineMeta={onDesPipelineMeta}
          rwEncryptStdout={results.find((r) => r.id === "des-encrypt")?.stdout}
        />
      ) : partId === "tdes" ? (
        <TripleDESDemo
          plaintext={plaintext}
          setPlaintext={setPlaintext}
          onRealWorldChange={onRealWorldChange}
          onPipelineMeta={onPipelineMeta}
          rwEncryptStdout={results.find((r) => r.id === "tdes-encrypt")?.stdout}
        />
      ) : partId === "aes" ? (
        <AESDemo
          plaintext={plaintext}
          setPlaintext={setPlaintext}
          onRealWorldChange={onRealWorldChange}
          rwEncryptStdout={results.find((r) => r.id === "aes-encrypt")?.stdout}
        />
      ) : partId === "publickey" ? (
        <PublicKeyDemo
          subId={subId}
          plaintext={plaintext}
          setPlaintext={setPlaintext}
          onRealWorldChange={onRealWorldChange}
          rwResults={results}
          onKxMethodChange={onKxMethodChange}
        />
      ) : partId === "trust" ? (
        <TrustAuthDemo
          subId={subId}
          plaintext={plaintext}
          setPlaintext={setPlaintext}
          onRealWorldChange={onRealWorldChange}
        />
      ) : (
        <p>Part not built yet.</p>
      )}
    </Shell>
  );
}
