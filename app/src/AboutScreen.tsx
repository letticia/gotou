import { ChevronLeftIcon } from "./Icons";

const DICTIONARY_SOURCE_URL = "https://jodoshuzensho.jp/daijiten/";

interface AboutScreenProps {
  onClose: () => void;
}

export default function AboutScreen({ onClose }: AboutScreenProps) {
  return (
    <div className="settings-screen">
      <div className="settings-header">
        <button type="button" className="back-button" onClick={onClose}>
          <ChevronLeftIcon />
          <span>設定</span>
        </button>
      </div>
      <h2 className="settings-title">このアプリについて</h2>

      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          語灯(ごとう)は、浄土宗僧侶が個人で開発しているプロトタイプアプリです。
          浄土宗の公式アプリではありません。
        </p>
      </section>

      <h3 className="settings-subhead">辞書データについて</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          辞書の項目・本文は
          <a href={DICTIONARY_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            浄土宗大辞典
          </a>
          (jodoshuzensho.jp/daijiten/)を出典としています。
          本アプリは浄土宗大辞典と提携・協力関係にはなく、内容の正確性を保証するものではありません。
          最新かつ正式な内容は出典サイトでご確認ください。
        </p>
      </section>

      <h3 className="settings-subhead">勤行本文について</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          勤行モードで表示する経文・回向文等は、著作権保護期間の満了した原文
          (パブリックドメイン)に基づき、開発者が入力・校正したものです。
        </p>
      </section>
    </div>
  );
}
