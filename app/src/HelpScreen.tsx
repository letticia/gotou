import { ChevronLeftIcon } from "./Icons";

// アプリ内のマニュアル。内容はリポジトリのREADME.mdの「使い方」と対応させてある。
// 片方を直したらもう片方も直すこと(マークダウンを描画する仕組みは持たせていない)。
//
// 長い文が文字列の連結になっているのは、JSXが要素内の改行を半角スペースに
// 変換してしまうため。日本語の文中に空白が入り、折り返し位置によっては
// 「薄く、 いま読んでいる」のように字間が空いて見える。ソースの見た目のために
// 改行するときは、必ず連結の形にすること。

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
          {"辞書データを使うには、ホーム画面への追加(インストール)が必要です。"
            + "追加したアプリを開いて「ダウンロード開始」を押すと、辞書の取得が始まります"
            + "(約9,200項目。回線によっては数分かかります)。"}
        </p>
        <p className="settings-body-text">
          一度取得すれば、以後はオフラインで使えます。
        </p>
      </section>

      <h3 className="settings-subhead">辞書を引く</h3>
      <section className="settings-group settings-textblock">
        <ul className="settings-list">
          <li>
            {"何も入力していないときは「収録語から」に何語かを紹介します。タップすると"
              + "その項目が開きます。「ほかの語を見る」で引き直せます。"}
          </li>
          <li>読み(ひらがな)または見出し語を入れると、前方一致で候補が絞られます。</li>
          <li>
            旧字体・異体字は自動で吸収します(「彌」で「弥」、「佛」で「仏」など)。
          </li>
          <li>「A-」「A+」で文字の大きさを変えられます。</li>
          <li>
            {"本文中の橙色のリンクは他の項目へのリンクです。タップで移動し、"
              + "「戻る」で元の項目に帰れます。"}
          </li>
          <li>
            {"末尾に「↗」が付いたリンクは典拠リンクです。浄土宗全書テキストデータベースや"
              + "SAT大正蔵の該当ページを新しいタブで開きます。"}
          </li>
        </ul>
      </section>

      <h3 className="settings-subhead">御法語を読む</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          {"下のタブの「御法語」を開くと、『元祖大師御法語』(前篇31章・後篇31章)を"
            + "読み物として読めます。"}
        </p>
        <ul className="settings-list">
          <li>
            {"前篇・後篇を切り替えて、31章の一覧から読みたい章を選べます。"
              + "一覧には各章の一文要約が添えてあります。"}
          </li>
          <li>
            {"その日の日付と同じ番号の章に「今日」の印が付きます(1日なら第一章)。"}
          </li>
          <li>
            {"本文には語ごとにふりがなが付きます。「A-」「A+」で文字の大きさを"
              + "変えられます。"}
          </li>
          <li>章の末尾の「前の章」「次の章」で通して読めます。</li>
          <li>
            {"辞書の検索前の画面にも「今日の御法語」として前篇・後篇の当日の章が出ます。"
              + "タップするとその章が開きます。"}
          </li>
        </ul>
        <p className="settings-body-text">
          {"一文要約は本文をもとに書き起こしたもので、校正の途上にあります。"
            + "正確な内容は本文にあたってください。"}
        </p>
      </section>

      <h3 className="settings-subhead">一節から典拠をさがす</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          {"「この一節、出典はどこだったか」を調べる機能です。入力欄の下のトグルで"
            + "「一節から典拠をさがす」に切り替え、調べたい一節を貼り付けてください。"}
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
            <b>浄土宗全書テキストデータベース</b>
            {" … 手元に無い場合の全文検索。結果は外部サイトから直接読み込んで表示します。"}
          </li>
        </ul>
        <p className="settings-body-text">
          {"辞書の本文を読んでいるときに一節を範囲選択すると、画面下に"
            + "「この一節の典拠をさがす」が出ます。そのまま渡せます。"}
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
            {"十念・三唱礼は、既定では名前を1回示すだけで次に進みます。回数を数えたい場合は"
              + "設定で切り替えてください。"}
          </li>
        </ul>
      </section>

      <h3 className="settings-subhead">いまどこを読んでいるか</h3>
      <section className="settings-group settings-textblock">
        <ul className="settings-list">
          <li>
            {"ヘッダー右の「≡ 2 / 18」が、式次第の何番目かを示します。画面のいちばん上の"
              + "細い帯は全体の進み具合です。"}
          </li>
          <li>
            {"この「≡ 2 / 18」を押すと式次第の一覧が開きます。読み終えた偈文は薄く、"
              + "いま読んでいる偈文には「いまここ」が付きます。"}
          </li>
          <li>
            {"一覧の偈文を選ぶとその先頭へ飛べます。十念のように何度も出てくる偈文も、"
              + "左の番号で見分けられます。"}
          </li>
        </ul>
      </section>

      <h3 className="settings-subhead">中断してしまったとき</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          {"おつとめの途中でアプリが閉じてしまっても、位置は覚えています。もう一度開くと、"
            + "差定名の出る扉の画面に「続きから ─ ◯◯」が出ます。"}
        </p>
        <ul className="settings-list">
          <li>
            押すと中断したところから続けられます(数えかけの十念の残り回数も戻ります)。
          </li>
          <li>押さずに画面をタップすれば、いつもどおりはじめからです。</li>
          <li>半日たった中断位置や、読み終えたおつとめについては出ません。</li>
        </ul>
      </section>

      <h3 className="settings-subhead">日替わり御法語</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          {"差定を選ぶ画面の「日常勤行式（四奉請・日替わり御法語版）」または"
            + "「（三奉請・日替わり御法語版）」を選ぶと、一枚起請文のところが"
            + "その日の御法語に替わります。"}
        </p>
        <ul className="settings-list">
          <li>
            {"その日の日付と同じ番号の章を読みます(1日なら第一章、30日なら第三十章)。"
              + "知恩院の「今日のお言葉」と同じ数え方です。"}
          </li>
          <li>
            {"章は31までなので、第29〜31章はその日がある月にだけ登場します"
              + "(2月は第29章まで、小の月は第30章まで)。"}
          </li>
          <li>扉の画面に「本日の御法語: 前篇第三章 聖浄二門」と出ます。</li>
          <li>前篇・後篇のどちらを読むかは設定で選べます(既定は前篇)。</li>
          <li>
            {"章はおつとめを始めるときに決まり、読んでいる途中で入れ替わることは"
              + "ありません。日付をまたいで「続きから」で再開したときは、その日の章になります。"}
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
            {"「共有」からQRコードやURLで受け渡しできます。受け取った側は開くだけで"
              + "取り込みの確認が出ます。"}
          </li>
        </ul>
      </section>

      <h3 className="settings-subhead">オフラインでの利用</h3>
      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          {"辞書と勤行はオフラインで使えます。ただし典拠リンクと浄土宗全書の検索は"
            + "外部サイトを開くため、通信できる状態が必要です。"}
        </p>
      </section>
    </div>
  );
}
