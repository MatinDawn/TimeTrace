/**
 * 文艺短句素材库 — "今日还未留痕"时使用
 * ----------------------------------------------------
 * 主题：记忆 / 痕迹 / 时光 / 当下
 * 规则：每条 2 句，每句以 7-10 字为佳；中外混合，含古典、近代、译句
 * 用途：home 页 quote-card 山水图覆盖文案，
 *       当 todayRecordCount === 0 时随机抽取展示。
 */

const LITERARY_QUOTES = [
  // —— 古典中文 ——
  { line1: "岁月不居，时节如流", line2: "且把流光，记入心头" },
  { line1: "云在青天水在瓶", line2: "心如止水亦如风" },
  { line1: "山静似太古", line2: "日长如小年" },
  { line1: "浮生若梦为欢几何", line2: "且记今朝以慰流年" },
  { line1: "人生若只如初见", line2: "何事秋风悲画扇" },
  { line1: "此情可待成追忆", line2: "只是当时已惘然" },
  { line1: "不知乘月几人归", line2: "落月摇情满江树" },
  { line1: "闲云潭影日悠悠", line2: "物换星移几度秋" },
  { line1: "山有木兮木有枝", line2: "心悦君兮君不知" },
  { line1: "今宵剩把银釭照", line2: "犹恐相逢是梦中" },
  { line1: "落花人独立", line2: "微雨燕双飞" },
  { line1: "明月几时有", line2: "把酒问青天" },

  // —— 近代/译句 ——
  { line1: "记忆是心灵的回声", line2: "也是时光留下的诗" },
  { line1: "把每一天写成情书", line2: "寄给将来的自己" },
  { line1: "所有的相遇皆有缘", line2: "所有的留痕皆有响" },
  { line1: "让风替我记得你", line2: "让光替我珍藏你" },
  { line1: "今日所行，皆是来路", line2: "今日所记，皆为远方" },
  { line1: "时光不语，静水流深", line2: "细数从前，不负当下" },
  { line1: "一寸光阴一寸金", line2: "一段往事一段心" },
  { line1: "把日子折成一只船", line2: "载着回忆缓缓向前" }
];

/**
 * 从素材库随机抽取一条文艺短句
 * @returns {{ line1: string, line2: string, source: 'preset' }}
 */
function pickLiteraryQuote() {
  const index = Math.floor(Math.random() * LITERARY_QUOTES.length);
  const quote = LITERARY_QUOTES[index] || LITERARY_QUOTES[0];
  return {
    line1: quote.line1,
    line2: quote.line2,
    source: "preset"
  };
}

module.exports = {
  LITERARY_QUOTES,
  pickLiteraryQuote
};
