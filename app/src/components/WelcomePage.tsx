import { useState, useEffect, useCallback } from 'react';
import {
  Flame, MapPin, AlertTriangle, Trophy, Target,
  Store, Paintbrush, ChevronDown, Radio,
  ShoppingBag, Users, Skull, Clock,
  BarChart3, Megaphone, Package,
  TrendingUp, Utensils, Truck,
  ShieldAlert, ChevronRight, TrendingDown,
} from 'lucide-react';

interface WelcomePageProps {
  onStart: () => void;
}

// ============ 真实翻车案例 ============

interface FailureCase {
  icon: string;
  money: string;
  type: string;
  location: string;
  dailyRevenue: string;
  highlight: string;
  tag: string;
}

const TAG_COLORS: Record<string, string> = {
  '传奇案例': 'text-purple-400 border-purple-500/30 bg-purple-500/5',
  '地狱难度': 'text-red-400 border-red-500/30 bg-red-500/5',
  '快招陷阱': 'text-orange-400 border-orange-500/30 bg-orange-500/5',
  'IP碰瓷': 'text-blue-400 border-blue-500/30 bg-blue-500/5',
  '空手套白狼': 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
  '定位灾难': 'text-pink-400 border-pink-500/30 bg-pink-500/5',
  '选址鬼才': 'text-green-400 border-green-500/30 bg-green-500/5',
  '装修灾难': 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5',
  '概念翻车': 'text-violet-400 border-violet-500/30 bg-violet-500/5',
};

const DISASTER_CASES_ROW1: FailureCase[] = [
  { icon: '🧋', money: '≈0', type: '脚盆果汁店', location: '蜜雪冰城对面', dailyRevenue: '50元', highlight: '连麦三年最震撼的创业', tag: '传奇案例' },
  { icon: '🏢', money: '100万', type: '百万奶茶大厦', location: '整栋楼·7员工', dailyRevenue: '800元', highlight: '日人工900，拿勇哥当抖加', tag: '地狱难度' },
  { icon: '🍔', money: '45万', type: 'DSDHB·河南', location: '华莱士隔壁', dailyRevenue: '0→倒闭', highlight: '快招套路：塔斯汀高管单干', tag: '快招陷阱' },
  { icon: '📍', money: '78万', type: 'DSDHB·西安', location: '华莱士隔壁', dailyRevenue: '持续亏损', highlight: '同一套路，不同城市', tag: '快招陷阱' },
  { icon: '🔥', money: '40万+', type: 'NZ仙饮', location: '碰瓷NZ IP', dailyRevenue: '300元', highlight: '承诺：三年十店，打败蜜雪', tag: 'IP碰瓷' },
  { icon: '💉', money: '40万', type: 'BNSYNR咖啡', location: '写字楼', dailyRevenue: '≈0', highlight: '加盟送车（4年后过户）', tag: '空手套白狼' },
];

const DISASTER_CASES_ROW2: FailureCase[] = [
  { icon: '🧋', money: '7万', type: '中药奶茶', location: '小学门口', dailyRevenue: '200元', highlight: '小学生喝养生奶茶', tag: '定位灾难' },
  { icon: '🍺', money: '18万', type: '村里开酒吧', location: '村里·大师罗盘选址', dailyRevenue: '10天亏光', highlight: '大师说风水好', tag: '选址鬼才' },
  { icon: '🍰', money: '40→100万债', type: '烘焙店', location: '6员工×4000工资', dailyRevenue: '1000元', highlight: '装修成理发店模样', tag: '装修灾难' },
  { icon: '🍵', money: '???', type: '禅意奶茶', location: '山路上·远离寺庙', dailyRevenue: '???', highlight: '选址在山上，客人爬山喝茶', tag: '选址鬼才' },
  { icon: '🥛', money: '???', type: '无名酸奶铺', location: '蜜雪冰城旁边', dailyRevenue: '60元', highlight: '跟蜜雪打价格战', tag: '定位灾难' },
  { icon: '🤖', money: '???', type: 'AI小吃店', location: '不详', dailyRevenue: '40元', highlight: '用AI写歌推广', tag: '概念翻车' },
];

// ============ 快招收割链条 ============

const SCAM_TRAPS = [
  { step: '01', title: '搜索引擎买广告', desc: '盗版品牌网站，排名比官网还高' },
  { step: '02', title: '电话话术洗脑', desc: '"大品牌饱和了"，推荐"子品牌"' },
  { step: '03', title: '总部考察陷阱', desc: '写字楼样板间，没有一家直营店' },
  { step: '04', title: '选址老师套路', desc: '故意选垃圾位置，骗取转让费回扣' },
  { step: '05', title: '收割链条闭环', desc: '加盟费→设备费→物料费→装修费' },
];

// ============ 勇哥语录 ============

interface QuoteItem {
  text: string;
  emphasis?: string;
}

const YONGGE_QUOTES: QuoteItem[] = [
  { text: '哎哟我滴妈！', emphasis: '这店能开？' },
  { text: '中年破产四件套：', emphasis: '奶茶、咖啡、汉堡和烘焙！' },
  { text: '穷人的钱，', emphasis: '好骗，但不好赚。' },
  { text: '来，360度转一圈，', emphasis: '让我看看你的店' },
  { text: '该起诉起诉，', emphasis: '让法务整理流程给你' },
  { text: '你凭什么觉得你能干得过', emphasis: '旁边的蜜雪呢？' },
  { text: '总部哪里的？', emphasis: '济南？那你完了' },
  { text: '不要跟我说感觉，', emphasis: '给我看数据！' },
  { text: '干不了哥们，', emphasis: '关了吧，今天就关' },
  { text: '人工比营业额还高，', emphasis: '你在做慈善呢？' },
  { text: '然后你就', emphasis: '把钱交了？' },
  { text: '赚钱的方式千篇一律，', emphasis: '亏钱的方式千姿百态。' },
];

// ============ 筹备阶段流程 ============

const SETUP_STEPS = [
  { icon: Store, label: '选品牌', desc: '加盟大牌 or 自主创业，小心快招陷阱', color: 'text-orange-400' },
  { icon: MapPin, label: '选址', desc: '学校/写字楼/社区/景区/商场，人流决定生死', color: 'text-cyan-400' },
  { icon: Paintbrush, label: '装修', desc: '简约/文艺/工业风，档次影响客单价', color: 'text-purple-400' },
  { icon: ShoppingBag, label: '选品', desc: '奶茶/咖啡/汉堡/盒饭...选什么卖什么', color: 'text-pink-400' },
  { icon: Users, label: '招人', desc: '店员/厨师/店长，人工是最大的固定成本', color: 'text-amber-400' },
];

// ============ 经营阶段系统 ============

const OPERATING_SYSTEMS = [
  { icon: TrendingUp, label: '经营', desc: '每周推进，观察收入与支出', color: 'text-emerald-400' },
  { icon: Utensils, label: '供需', desc: '堂食+外卖双通道，供给=库存×出餐能力', color: 'text-cyan-400' },
  { icon: BarChart3, label: '财务', desc: '收入、成本、毛利率、盈亏平衡点', color: 'text-blue-400' },
  { icon: Megaphone, label: '营销', desc: '曝光度+口碑双指标，花钱引流', color: 'text-yellow-400' },
  { icon: Users, label: '人员', desc: '排班、培训、士气管理，员工会离职', color: 'text-amber-400' },
  { icon: Package, label: '库存', desc: '补货策略、损耗控制、缺货惩罚', color: 'text-orange-400' },
  { icon: Truck, label: '外卖', desc: '美团/饿了么/抖音', color: 'text-red-400' },
  { icon: Radio, label: '连麦勇哥', desc: '赛博勇哥实时诊断你的经营问题', color: 'text-rose-400' },
];

// ============ 主组件 ============

export function WelcomePage({ onStart }: WelcomePageProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [glitch, setGlitch] = useState(false);

  // 语录轮播
  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % YONGGE_QUOTES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // 标题 glitch 效果
  const triggerGlitch = useCallback(() => {
    setGlitch(true);
    setTimeout(() => setGlitch(false), 300);
  }, []);

  useEffect(() => {
    const timer = setInterval(triggerGlitch, 6000);
    return () => clearInterval(timer);
  }, [triggerGlitch]);

  return (
    <div className="min-h-screen bg-[#0a0e17] ark-grid-bg relative overflow-hidden">
      <BackgroundEffects />

      {/* Hero：标题 + 一句话介绍 + 勇哥语录 */}
      <HeroSection glitch={glitch} quoteIndex={quoteIndex} />

      {/* 翻车案例跑马灯 */}
      <DisasterMarquee />

      {/* 快招收割链条 */}
      <ScamChainSection />

      {/* 怎么玩：筹备阶段 + 经营阶段 */}
      <HowToPlaySection />

      {/* 选址金句 */}
      <LocationQuoteSection />

      {/* 胜利 / 失败条件 + CTA */}
      <WinLoseSection onStart={onStart} />

      {/* 底部 */}
      <footer className="text-center py-8 border-t border-[#1e293b] space-y-1">
        <p className="text-xs text-slate-600">
          本游戏纯属虚构，如有雷同说明你也踩坑了
        </p>
        <p className="text-xs text-slate-500">
          作者微信：niuniu-869
        </p>
      </footer>
    </div>
  );
}

// ============ 背景装饰 ============

function BackgroundEffects() {
  return (
    <>
      {/* 顶部扫描线 */}
      <div className="absolute inset-0 pointer-events-none ark-scanline" />
      {/* 左上角装饰线 */}
      <div className="absolute top-0 left-0 w-48 h-px bg-gradient-to-r from-orange-500/60 to-transparent" />
      <div className="absolute top-0 left-0 h-48 w-px bg-gradient-to-b from-orange-500/60 to-transparent" />
      {/* 右下角装饰线 */}
      <div className="absolute bottom-0 right-0 w-48 h-px bg-gradient-to-l from-orange-500/30 to-transparent" />
      <div className="absolute bottom-0 right-0 h-48 w-px bg-gradient-to-t from-orange-500/30 to-transparent" />
    </>
  );
}

// ============ Hero 区域 ============

function HeroSection({ glitch, quoteIndex }: { glitch: boolean; quoteIndex: number }) {
  return (
    <section className="relative flex flex-col items-center justify-center min-h-[85vh] px-4">
      {/* 顶部标签 */}
      <div className="mb-8 flex items-center gap-2">
        <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-500 border border-orange-500/30 bg-orange-500/5">
          速通餐饮创业
        </span>
        <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-500 border border-red-500/30 bg-red-500/5">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          从开店到360度转一圈
        </span>
      </div>

      {/* 主标题 */}
      <h1 className={`text-5xl md:text-7xl font-black text-center leading-tight mb-4 ${glitch ? 'ark-glitch' : ''}`}>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-orange-400">
          360° 转一圈
        </span>
      </h1>

      {/* 副标题 */}
      <p className="text-lg md:text-xl text-slate-400 text-center mb-2 max-w-lg">
        <span className="line-through text-slate-600 mr-2">创业致富模拟器</span>
        <span className="text-red-400">创业踩坑模拟器</span>
      </p>
      <p className="text-sm text-slate-500 text-center mb-4 max-w-md leading-relaxed">
        你有 <span className="text-orange-400 font-bold">40 万启动资金</span>，
        从选品牌、选址、装修、选品到招人，
        一步步开出自己的餐饮店，然后努力活下去。
      </p>
      <p className="text-xs text-slate-600 text-center mb-10">
        灵感来源：网红博主<span className="text-orange-400">「勇哥」</span>的创业避坑连麦系列
      </p>

      {/* 勇哥语录轮播 */}
      <div className="relative w-full max-w-md mb-12">
        <div className="ark-card p-5 border-orange-500/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 bg-orange-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 min-h-[48px]">
              <p className="text-xs text-orange-500/60 mb-1 font-bold tracking-wider uppercase">
                勇哥说
              </p>
              <p className="text-sm text-slate-200 leading-relaxed transition-all duration-500">
                "{YONGGE_QUOTES[quoteIndex].text}
                {YONGGE_QUOTES[quoteIndex].emphasis && (
                  <span className="text-orange-400 font-bold">{YONGGE_QUOTES[quoteIndex].emphasis}</span>
                )}"
              </p>
            </div>
          </div>
          {/* 语录进度条 */}
          <div className="flex gap-1 mt-3">
            {YONGGE_QUOTES.map((_, i) => (
              <div
                key={i}
                className={`h-0.5 flex-1 transition-all duration-300 ${
                  i === quoteIndex ? 'bg-orange-500' : 'bg-[#1e293b]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 向下滚动提示 */}
      <div className="absolute bottom-8 animate-float-bounce">
        <ChevronDown className="w-6 h-6 text-slate-500" />
      </div>
    </section>
  );
}

// ============ 翻车案例跑马灯 ============

function DisasterMarquee() {
  const renderCase = (c: FailureCase, i: number) => (
    <div
      key={`${c.type}-${i}`}
      className="inline-flex items-start gap-3 px-5 py-3 mx-2 bg-[#151d2b] border border-[#1e293b] hover:border-red-500/40 transition-colors shrink-0 group min-w-[280px]"
    >
      <span className="text-2xl mt-0.5">{c.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-red-400">-{c.money}</span>
          <span className="text-sm font-bold text-white group-hover:text-red-300 transition-colors truncate">
            {c.type}
          </span>
          <span className={`px-1.5 py-0.5 text-[9px] font-bold border shrink-0 ${TAG_COLORS[c.tag] || 'text-slate-400 border-slate-500/30 bg-slate-500/5'}`}>
            {c.tag}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-1">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-orange-400/60" />{c.location}
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-400/60" />日营{c.dailyRevenue}
          </span>
        </div>
        <p className="text-[10px] text-slate-600 italic group-hover:text-slate-400 transition-colors">
          "{c.highlight}"
        </p>
      </div>
    </div>
  );

  return (
    <section className="py-10 border-y border-[#1e293b] overflow-hidden">
      {/* 区域标题 */}
      <div className="text-center mb-6">
        <span className="px-4 py-1.5 text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/5 tracking-wider uppercase">
          <AlertTriangle className="w-3 h-3 inline mr-1.5" />
          真实翻车案例 · 均来自勇哥连麦
        </span>
      </div>

      {/* 第一行：向左滚动 */}
      <div className="relative mb-3">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...DISASTER_CASES_ROW1, ...DISASTER_CASES_ROW1].map(renderCase)}
        </div>
      </div>

      {/* 第二行：向右滚动 */}
      <div className="relative">
        <div className="flex animate-marquee-reverse whitespace-nowrap">
          {[...DISASTER_CASES_ROW2, ...DISASTER_CASES_ROW2].map(renderCase)}
        </div>
      </div>
    </section>
  );
}

// ============ 怎么玩 ============

function HowToPlaySection() {
  return (
    <section className="py-16 px-4 border-t border-[#1e293b]">
      <div className="max-w-5xl mx-auto">
        {/* 区域标题 */}
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
            怎么玩？
          </h2>
          <p className="text-sm text-slate-500">
            游戏分为<span className="text-orange-400 font-bold">筹备</span>和<span className="text-emerald-400 font-bold">经营</span>两个阶段
          </p>
        </div>

        {/* 筹备阶段 */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <span className="text-xs font-black text-orange-400">01</span>
            </div>
            <h3 className="text-lg font-black text-orange-400">筹备阶段</h3>
            <span className="text-xs text-slate-600 ml-2">—— 花钱的艺术</span>
          </div>

          <div className="flex items-start justify-between relative">
            <div className="absolute top-6 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
            {SETUP_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex flex-col items-center gap-2 relative z-10 flex-1">
                  <div className="w-12 h-12 bg-[#151d2b] border border-[#1e293b] flex items-center justify-center hover:border-orange-500/50 transition-all hover:translate-y-[-2px]">
                    <Icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-600">0{i + 1}</span>
                  <span className={`text-sm font-bold ${step.color}`}>{step.label}</span>
                  <span className="text-[11px] text-slate-500 text-center leading-relaxed px-1">{step.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 经营阶段 */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-xs font-black text-emerald-400">02</span>
            </div>
            <h3 className="text-lg font-black text-emerald-400">经营阶段</h3>
            <span className="text-xs text-slate-600 ml-2">—— 每周推进，8 大系统</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {OPERATING_SYSTEMS.map((sys) => {
              const Icon = sys.icon;
              return (
                <div
                  key={sys.label}
                  className="ark-card p-4 flex items-start gap-3 hover:border-[#2a3548] transition-colors"
                >
                  <Icon className={`w-4 h-4 ${sys.color} shrink-0 mt-0.5`} />
                  <div>
                    <p className={`text-sm font-bold ${sys.color}`}>{sys.label}</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{sys.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ 快招收割链条 ============

function ScamChainSection() {
  return (
    <section className="py-16 px-4 border-t border-[#1e293b]">
      <div className="max-w-5xl mx-auto">
        {/* 区域标题 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            <span className="px-4 py-1.5 text-xs font-bold text-orange-400 border border-orange-500/30 bg-orange-500/5 tracking-wider uppercase">
              快招公司收割链条
            </span>
            <ShieldAlert className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-sm text-slate-500">
            从搜索引擎到签约收割，<span className="text-orange-400 font-bold">5 步套路</span>环环相扣
          </p>
        </div>

        {/* 链条步骤 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {SCAM_TRAPS.map((trap, idx) => (
            <div key={idx} className="relative">
              <div className="ark-card p-4 border-orange-500/10 hover:border-orange-500/40 transition-colors h-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[10px] font-black text-orange-400 shrink-0">
                    {trap.step}
                  </span>
                  <h4 className="text-sm font-bold text-white leading-tight">{trap.title}</h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{trap.desc}</p>
              </div>
              {/* 连接箭头 */}
              {idx < SCAM_TRAPS.length - 1 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <ChevronRight className="w-5 h-5 text-orange-500/40" />
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          游戏中选择快招品牌将触发完整收割链条体验 —— <span className="text-red-400">慎选</span>
        </p>
      </div>
    </section>
  );
}

// ============ 选址金句 ============

function LocationQuoteSection() {
  return (
    <section className="py-12 px-4 border-t border-[#1e293b] bg-gradient-to-r from-orange-500/[0.03] via-red-500/[0.03] to-orange-500/[0.03]">
      <div className="max-w-3xl mx-auto text-center">
        <MapPin className="w-8 h-8 text-orange-500 mx-auto mb-3" />
        <p className="text-xs text-slate-500 mb-3 uppercase tracking-widest font-bold">勇哥选址金句</p>
        <p className="text-3xl md:text-4xl font-black mb-4">
          <span className="text-amber-400">"金角</span>
          <span className="text-slate-400 mx-1">银边</span>
          <span className="text-red-400">草肚皮"</span>
        </p>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          街角最好，沿街次之，中间最差。<br />
          人流动向决定生死，选址前先蹲三天。
        </p>
      </div>
    </section>
  );
}

// ============ 胜利 / 失败条件 + CTA ============

function WinLoseSection({ onStart }: { onStart: () => void }) {
  return (
    <section className="py-20 px-4 border-t border-[#1e293b]">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* 胜利条件 */}
        <div className="ark-card ark-corner-border p-6 border-emerald-500/20 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-[#0a0e17] border border-emerald-500/30">
              胜利条件（同时满足）
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-[#0a0e17] border border-[#1e293b]">
              <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-bold text-white">累计利润 ≥ 总投资额</p>
                <p className="text-[11px] text-slate-500">把投进去的每一分钱都赚回来——回本</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#0a0e17] border border-[#1e293b]">
              <Target className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-bold text-white">连续 6 周盈利</p>
                <p className="text-[11px] text-slate-500">证明你的店能稳定赚钱，不是靠运气</p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-600 text-center">
            两个条件<span className="text-emerald-400 font-bold">同时满足</span>才算赢
          </p>
        </div>

        {/* 失败条件 */}
        <div className="ark-card ark-corner-border p-6 border-red-500/20 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-400 bg-[#0a0e17] border border-red-500/30">
              失败条件
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-[#0a0e17] border border-[#1e293b]">
              <Skull className="w-5 h-5 text-red-400 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-bold text-white">破产</p>
                <p className="text-[11px] text-slate-500">现金耗尽（允许 ¥5,000 小额透支缓冲）</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#0a0e17] border border-[#1e293b]">
              <Clock className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-bold text-white">时间耗尽</p>
                <p className="text-[11px] text-slate-500">经营周数用完仍未达成胜利条件</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA 按钮 */}
        <div className="text-center space-y-4">
          <button
            className="
              ark-button ark-button-primary px-16 py-5 text-xl font-black
              tracking-wider uppercase animate-border-glow
              flex items-center gap-3 mx-auto
              hover:scale-105 transition-transform duration-300
            "
            onClick={onStart}
          >
            <Flame className="w-6 h-6" />
            开始踩坑
          </button>

          <p className="text-xs text-slate-600">
            初始资金 <span className="text-orange-400 font-bold">40 万</span>，亏完即止
          </p>
        </div>

      </div>
    </section>
  );
}
