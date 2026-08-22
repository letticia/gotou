import { ChevronLeftIcon } from "./Icons";

// アプリ内のマニュアル。内容はリポジトリのREADME.mdの「使い方」と対応させてある。
// 片方を直したらもう片方も直すこと(マークダウンを描画する仕組みは持たせていない)。

interface HelpScreenProps {
  onClose: () => void;
}

export default function HelpScreen({ onClose }: HelpScreenProps) {
  return (
    <div className="settings-screen">
      <div className="settings-header">
        <button type="button" className="back-button" onClick={onClose}>
          <ChevronLeftIcon />
          <span>設定</span>
        </button>
      </div>
      <h2 className="settings-title">使い方</h2>

      <h3 className="settings-subhead">はじめに</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          辞書データを使うには、ホーム画面への追加(インストール)が必要です。
          追加したアプリを開いて「ダウンロード開始」を押すと、辞書の取得が始まります
          (約9,200項目。回線によっては数分かかります)。
        </p>
        <p className="settings-body-text">
          一度取得すれば、以後はオフラインで使えます。
        </p>
      </section>

      <h3 className="settings-subhead">辞書を引く</h3>
      <section className="settings-group settings-textblock">
        <ul className="settings-list">
          <li>
            何も入力していないときは「収録語から」に何語かを紹介します。タップすると
            その項目が開きます。「ほかの語を見る」で引き直せます。
          </li>
          <li>読み(ひらがな)または見出し語を入れると、前方一致で候補が絞られます。</li>
          <li>
            旧字体・異体字は自動で吸収します(「彌」で「弥」、「佛」で「仏」など)。
          </li>
          <li>「A-」「A+」で文字の大きさを変えられます。</li>
          <li>
            本文中の橙色のリンクは他の項目へのリンクです。タップで移動し、
            「戻る」で元の項目に帰れます。
          </li>
          <li>
            末尾に「↗」が付いたリンクは典拠リンクです。浄土宗全書テキストデータベースや
            SAT大正蔵の該当ページを新しいタブで開きます。
          </li>
        </ul>
      </section>

      <h3 className="settings-subhead">一節から典拠をさがす</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          「この一節、出典はどこだったか」を調べる機能です。入力欄の下のトグルで
          「一節から典拠をさがす」に切り替え、調べたい一節を貼り付けてください。
        </p>
        <p className="settings-body-text">結果は3つのグループで出ます。</p>
        <ul className="settings-list">
          <li>
            <b>辞書の項目</b> … その一節を引用・解説している項目。タップで本文へ。
          </li>
          <li>
            <b>勤行テキスト</b> … 収録されている偈文と、それを含む差定の名前。
          </li>
          <li>
            <b>浄土宗全書テキストデータベース</b> … 手元に無い場合の全文検索。
            結果は外部サイトから直接読み込んで表示します。
          </li>
        </ul>
        <p className="settings-body-text">
          辞書の本文を読んでいるときに一節を範囲選択すると、画面下に
          「この一節の典拠をさがす」が出ます。そのまま渡せます。
        </p>
      </section>

      <h3 className="settings-subhead">勤行モード</h3>
      <section className="settings-group settings-textblock">
        <ul className="settings-list">
          <li>「差定を選ぶ」から、読むおつとめを選びます。</li>
          <li>差定名が出る扉の画面をタップすると始まります。</li>
          <li>画面をタップするとページが進みます。片手で持って親指で送れます。</li>
          <li>戻るときは左上の「← 前へ」。</li>
          <li>
            最後まで読むと「おつとめ、終わりです」が出ます。タップすると差定選択に戻ります。
          </li>
          <li>
            ヘッダーの「横書き / 縦書き」で表示を切り替えられます(既定は縦書きの経本表示)。
          </li>
          <li>
            十念・三唱礼は、既定では名前を1回示すだけで次に進みます。回数を数えたい場合は
            設定で切り替えてください。
          </li>
        </ul>
      </section>

      <h3 className="settings-subhead">差定を自分用に整える</h3>
      <section className="settings-group settings-textblock">
        <ul className="settings-list">
          <li>
            用意されている差定は雛形です。「複製して編集」すると自分の差定になります。
          </li>
          <li>
            自分の差定(「マイ差定」)は、偈文の並べ替え・オンオフ・回数の指定ができます。
          </li>
          <li>
            「共有」からQRコードやURLで受け渡しできます。受け取った側は開くだけで
            取り込みの確認が出ます。
          </li>
        </ul>
      </section>

      <h3 className="settings-subhead">オフラインでの利用</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          辞書と勤行はオフラインで使えます。ただし典拠リンクと浄土宗全書の検索は
          外部サイトを開くため、通信できる状態が必要です。
        </p>
      </section>
    </div>
  );
}
