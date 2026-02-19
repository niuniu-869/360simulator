import { useState } from 'react';
import { ChevronDown, ChevronUp, Video, MapPin, Calculator } from 'lucide-react';

interface CaseStudy {
  id: string;
  title: string;
  avatar: string;
  investment: string;
  weeklyLoss: string;
  location: string;
  scenario: string;
  diagnosis: string;
  yongGeQuote: string;
  lesson: string;
}

const caseStudies: CaseStudy[] = [
  {
    id: 'milktea-tower',
    title: '奶茶大厦哥',
    avatar: '🏢',
    investment: '90万',
    weeklyLoss: '每天亏800，人工就要900',
    location: '废弃商场',
    scenario: '本想加盟蜜雪冰城，打了网上找的"官方电话"，对方说"蜜雪的水太深了"，推荐了一家"蜜雪的子品牌"。去总部写字楼样板间尝了一下觉得不错就签约了。积蓄30万+网上贷款60万，还把房子抵押了。租了一整栋楼，1-2楼奶茶店、3-4楼棋牌室、6楼网红打卡点，还打算在5楼开零食店。雇了7个员工，设了"楼长"。',
    diagnosis: '日营业额800元，人工就要900元，还没算租金水电。',
    yongGeQuote: '「来，360度转一圈。这地方根本没人流啊！楼上写字楼就是客源？人家下班直接回家了！一天卖800块你请7个人？现在就给我去把那4个员工开了！该起诉起诉，让总部把加盟费退回来。」',
    lesson: '快招公司套路：你想加盟A品牌，网上搜到"官方电话"，对方说A品牌饱和了/水深，推荐"子品牌"，总部只有样板间。'
  },
  {
    id: 'oyster-bro',
    title: '生蚝哥',
    avatar: '🦪',
    investment: '10万',
    weeklyLoss: '全赔光，卖车被骗2000',
    location: '小区内部',
    scenario: '借了10万块钱，在小区里开了一家海鲜店，但别的不卖，纯卖生蚝。理由是探查过市场，发现周围没有纯卖生蚝的店，认为是商机留白。勇哥劝说不行，他说他的生蚝质量高、便宜。',
    diagnosis: '周围没人卖生蚝是因为没人买，不是商机是陷阱。',
    yongGeQuote: '「周围没人卖生蚝就是商机？那是没人买！你卖车找达人宣传还被骗2000，赶紧关了吧！」',
    lesson: '没有需求的地方就没有市场，便宜和好产品不能创造需求。'
  },
  {
    id: 'fourth-burger',
    title: '第四代汉堡哥',
    avatar: '🍔',
    investment: '45万',
    weeklyLoss: '月亏16770',
    location: '华莱士隔壁',
    scenario: '北漂打工攒下的45万积蓄，加盟了"第四代汉堡"。对方说是"塔斯汀高管出来单干的品牌"。选址老师专门跑了3天，选在了华莱士隔壁，说这个品牌会干倒华莱士。街对面还有肯德基和塔斯汀。',
    diagnosis: '杂牌汉堡开在华莱士、肯德基、塔斯汀包围圈里，没有任何竞争力。',
    yongGeQuote: '「你想加盟塔斯汀，结果打到快招公司去了？他们说这是塔斯汀高管出来单干？骗鬼呢！你凭什么觉得能干得过旁边的华莱士？人家上市公司全球4万家店，你觉得不怎么样？」',
    lesson: '不要和头部品牌正面竞争，"第四代XX"基本都是快招套路。'
  },
  {
    id: 'juice-aunt',
    title: '鲜榨果汁大姐',
    avatar: '🧃',
    investment: '2万',
    weeklyLoss: '日销50元',
    location: '蜜雪冰城旁边',
    scenario: '在蜜雪冰城旁边开了一家鲜榨果汁店，用塑料洗脚盆装工具。认为蜜雪不够健康，自己的鲜榨果汁主打健康。勇哥问她凭什么能干得过蜜雪，她说"他们那个也不怎么样嘛，便宜没好货，我从来没喝过"。',
    diagnosis: '用洗脚盆做果汁，开在蜜雪隔壁，日均50元营业额。',
    yongGeQuote: '「你凭什么觉得能干得过旁边的蜜雪呢？人家上市公司全球4万家店，你觉得不怎么样？学生们放着5元柠檬水不喝，会来你这喝6元的洗脚盆果汁？」',
    lesson: '不要用自己的主观判断代替市场判断，头部品牌的存在是有道理的。'
  },
  {
    id: 'korea-coffee',
    title: '韩国咖啡姐',
    avatar: '☕',
    investment: '160万',
    weeklyLoss: '总部跑路，自己成总代',
    location: '商场过道',
    scenario: '投资160万加盟"韩国网红咖啡"品牌，店面窄得像商场过道。开业后品牌总部跑路，自己成了全国只此一家的"总代理"。',
    diagnosis: '160万亏掉一辆迈巴赫，总部跑路，供应链断裂。',
    yongGeQuote: '「160万加盟这品牌？总部在哪？济南？就一样板间是吧？快招公司！现在总部跑路了，你成总代了，上哪进货去？」',
    lesson: '加盟前一定要核实品牌真实性，看直营店数量，不要轻信"网红品牌"。'
  },
  {
    id: 'village-bar',
    title: '村里开酒吧哥',
    avatar: '🍺',
    investment: '18万',
    weeklyLoss: '10天亏18万',
    location: '村里',
    scenario: '靠父母贷款在村门口开酒吧，选址全靠大师用罗盘算。',
    diagnosis: '村里没有酒吧消费场景，选址完全脱离实际。',
    yongGeQuote: '「在村里开酒吧？选址靠大师罗盘？来，360度转一圈，这地方有人流吗？关了吧，今天就关。」',
    lesson: '选址要科学，看人流、看竞品，不要迷信风水。'
  }
];

export function YongGeTeaching() {
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-orange-500 mb-4">
        <Video className="w-5 h-5" />
        <span className="font-bold">勇哥经典案例库</span>
      </div>

      <div className="grid gap-3">
        {caseStudies.map((caseItem) => {
          const isExpanded = expandedCase === caseItem.id;
          
          return (
            <div 
              key={caseItem.id}
              className="bg-[#0a0e17] border border-[#1e293b] overflow-hidden"
            >
              {/* 案例标题栏 */}
              <button
                className="w-full p-4 flex items-center justify-between hover:bg-[#1a2332] transition-colors"
                onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{caseItem.avatar}</span>
                  <div className="text-left">
                    <h4 className="font-bold text-white">{caseItem.title}</h4>
                    <p className="text-xs text-slate-400">投资{caseItem.investment} · {caseItem.weeklyLoss}</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* 展开内容 */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[#1e293b]">
                  <div className="pt-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-blue-400 mt-0.5" />
                      <p className="text-sm text-slate-300">{caseItem.location}</p>
                    </div>
                    
                    <div className="bg-[#151d2b] p-3 border border-[#1e293b]">
                      <p className="text-xs text-slate-500 mb-1">案情</p>
                      <p className="text-sm text-slate-300">{caseItem.scenario}</p>
                    </div>

                    <div className="bg-[#151d2b] p-3 border border-[#1e293b]">
                      <p className="text-xs text-slate-500 mb-1">财务诊断</p>
                      <p className="text-sm text-red-400">{caseItem.diagnosis}</p>
                    </div>

                    <div className="bg-orange-500/10 border-l-4 border-orange-500 p-3">
                      <p className="text-xs text-orange-500 mb-1">勇哥原话</p>
                      <p className="text-sm text-slate-200 italic">{caseItem.yongGeQuote}</p>
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-3">
                      <p className="text-xs text-emerald-500 mb-1">避坑要点</p>
                      <p className="text-sm text-slate-300">{caseItem.lesson}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 勇哥诊断流程 */}
      <div className="bg-[#0a0e17] p-4 border border-[#1e293b] mt-4">
        <h4 className="font-bold text-white mb-3 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-orange-500" />
          勇哥诊断公式
        </h4>
        <div className="space-y-2 text-sm text-slate-400">
          <p>1. 「你好哥们，遇到什么问题了？」</p>
          <p>2. 「开之前认识我吗？认识的话为什么不先问一下我？」</p>
          <p>3. 「店开下来总共花费多少？哎哟我滴妈，这都xx万了！」</p>
          <p>4. 「公司总部哪里的？你去过总部吗？总部有店吗？还是就一样板间？」</p>
          <p>5. 「<span className="text-orange-500">来，360度转一圈</span>，我看看商圈」</p>
          <p>6. 「干不了哥们，这根本就没有人流，关了吧，今天就关」</p>
          <p>7. 「该起诉起诉，让他们把加盟费退回来」</p>
        </div>
      </div>
    </div>
  );
}
