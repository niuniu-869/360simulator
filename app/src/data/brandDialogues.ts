// 品牌选择对话流程数据
// 为每个品牌设计差异化的"拐走"剧情

export interface DialogueOption {
  id: string;
  text: string;
  trapScore: number;  // 被拐走分数
  nextNodeId: string | null;
}

export interface DialogueNode {
  id: string;
  type: 'system' | 'npc' | 'player' | 'thinking';
  speaker?: string;
  content: string;
  requireChoice: boolean;
  options?: DialogueOption[];
  nextNodeId?: string | null;
  effect?: {
    type: 'countdown' | 'highlight' | 'shake';
    duration?: number;
  };
}

// 快招品牌映射
export const quickFranchiseMap: Record<string, string> = {
  'mixue': 'nezha',
  'tastien': 'hamburg4',
  'luckin': 'koreacoffee',
  'chabaidao': 'nezha',
};

// 快招品牌宣传数据
export const quickFranchisePromo: Record<string, {
  name: string;
  highlights: string[];
  originalPrice: string;
  currentPrice: string;
  deadline: string;
}> = {
  'nezha': {
    name: '哪吒仙饮',
    highlights: [
      '🎯 《哪吒3》官方联名，自带10亿流量',
      '💰 加盟费仅15.8万（比蜜雪便宜近10万）',
      '📈 总部承诺：3个月回本，6个月盈利',
      '🏆 荣获"2025年度最具潜力茶饮品牌"',
      '🎁 前50名签约送区域独家代理权',
    ],
    originalPrice: '25.8万',
    currentPrice: '15.8万',
    deadline: '2小时59分',
  },
  'hamburg4': {
    name: '燃熊中国汉堡',
    highlights: [
      '🔥 第四代汉堡革命，颠覆传统快餐',
      '💰 加盟费仅16.8万（塔斯汀一半价格）',
      '📈 总部承诺：日均营业额3000+',
      '🏆 塔斯汀核心团队倾力打造',
      '🎁 签约即送价值5万的开业大礼包',
    ],
    originalPrice: '32万',
    currentPrice: '16.8万',
    deadline: '今日截止',
  },
  'koreacoffee': {
    name: '清潭洞咖啡',
    highlights: [
      '🇰🇷 韩国顶级咖啡品牌，首次进入中国',
      '💰 高端定位，客单价45元起',
      '📈 杭州首店日营业额破2万',
      '🏆 韩国明星李敏镐代言',
      '🎁 全国仅开放100个城市代理',
    ],
    originalPrice: '60万',
    currentPrice: '45万',
    deadline: '名额仅剩3个',
  },
};

export const TRAP_THRESHOLD = 50;

// ========== 蜜雪冰城剧情：哪吒联名套路 ==========
function generateMixueDialogue(): DialogueNode[] {
  return [
    { id: 'start', type: 'system', content: '你在百度搜索"蜜雪冰城加盟电话"...', requireChoice: false, nextNodeId: 'search_result' },
    { id: 'search_result', type: 'system', content: '第一条结果显示：【官方】蜜雪冰城加盟热线 400-XXX-XXXX', requireChoice: false, nextNodeId: 'call' },
    { id: 'call', type: 'system', content: '📞 电话接通了', requireChoice: false, nextNodeId: 'npc1' },
    { id: 'npc1', type: 'npc', speaker: '招商经理', content: '您好，蜜雪冰城招商部，请问您想在哪个城市开店？', requireChoice: false, nextNodeId: 'player1' },
    { id: 'player1', type: 'player', content: '我想在我们市开一家蜜雪冰城。', requireChoice: false, nextNodeId: 'npc2' },
    { id: 'npc2', type: 'npc', speaker: '招商经理', content: '（叹气）哎，您那个市啊...蜜雪的门店已经饱和了，总部最近半年都没放名额。而且现在审核特别严，通过率不到10%...', requireChoice: false, nextNodeId: 'player2' },
    { id: 'player2', type: 'player', content: '啊？那怎么办？我都准备好资金了...', requireChoice: false, nextNodeId: 'npc3' },
    {
      id: 'npc3', type: 'npc', speaker: '招商经理',
      content: '这样，我跟您说个内部消息。我们集团刚推出一个新品牌叫【哪吒仙饮】，拿到了《哪吒3》的官方联名授权，是蜜雪原班研发团队打造的。您那个市还有名额，要不要了解一下？',
      requireChoice: true,
      options: [
        { id: 'interested', text: '哪吒联名？听起来挺火的，了解一下', trapScore: 30, nextNodeId: 'show_ppt' },
        { id: 'doubt', text: '原班团队？这品牌我怎么没听说过？', trapScore: 10, nextNodeId: 'npc_explain' },
        { id: 'refuse', text: '算了，我就想加盟蜜雪', trapScore: 0, nextNodeId: 'npc_persist' },
      ],
    },
    { id: 'npc_explain', type: 'npc', speaker: '招商经理', content: '您有所不知，哪吒仙饮是集团内部孵化的战略项目，专门针对年轻市场。《哪吒3》票房破50亿，这IP自带流量啊！现在加盟就是抢占先机，等品牌火了加盟费至少翻倍！', requireChoice: true,
      options: [
        { id: 'convinced', text: '这么说有道理，那我了解一下', trapScore: 25, nextNodeId: 'show_ppt' },
        { id: 'still_doubt', text: '我还是想加盟正规大品牌', trapScore: 0, nextNodeId: 'npc_persist' },
      ],
    },
    { id: 'npc_persist', type: 'npc', speaker: '招商经理', content: '您听我说，蜜雪现在排队要等半年，审核还不一定过。哪吒仙饮现在是红利期，我手上有个客户昨天刚签了省代。您这个市的名额真的不多了，错过就没了...', requireChoice: true,
      options: [
        { id: 'tempted', text: '那...先看看资料吧', trapScore: 25, nextNodeId: 'show_ppt' },
        { id: 'firm', text: '不用了，谢谢', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'show_ppt', type: 'system', content: '对方发来一份精美的招商PPT...', requireChoice: false, nextNodeId: 'ppt_content', effect: { type: 'highlight' } },
    { id: 'ppt_content', type: 'npc', speaker: '招商经理', content: '您看，哪吒联名杯、联名周边，开业就能引爆社交媒体！加盟费才15.8万，比蜜雪便宜近10万，总部还承诺3个月回本！', requireChoice: true,
      options: [
        { id: 'excited', text: '15.8万？这么便宜！怎么加盟？', trapScore: 30, nextNodeId: 'urgency' },
        { id: 'cautious', text: '承诺回本？这能写进合同吗？', trapScore: 5, nextNodeId: 'npc_dodge' },
        { id: 'skeptical', text: '我想先看看你们的实际门店', trapScore: 0, nextNodeId: 'npc_no_store' },
      ],
    },
    { id: 'npc_dodge', type: 'npc', speaker: '招商经理', content: '这个...合同里会有相关条款的。我们有专业的运营团队全程扶持，选址、装修、培训一条龙服务，保证您轻松开店！', requireChoice: true,
      options: [
        { id: 'believe', text: '有运营扶持就放心了', trapScore: 25, nextNodeId: 'urgency' },
        { id: 'push', text: '我要看到白纸黑字的承诺', trapScore: 0, nextNodeId: 'npc_defensive' },
      ],
    },
    { id: 'npc_no_store', type: 'npc', speaker: '招商经理', content: '实际门店...为了保护加盟商利益，地址是保密的。不过您可以来济南总部考察，我们有专业的培训基地和样板间，包食宿专车接！', requireChoice: true,
      options: [
        { id: 'go', text: '那我去总部看看', trapScore: 20, nextNodeId: 'visit' },
        { id: 'suspicious', text: '连门店都不让看？算了吧', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'npc_defensive', type: 'npc', speaker: '招商经理', content: '（语气变冷）您这人怎么这么多疑问？我们是正规公司，有营业执照有商标。您不信就算了，这名额抢手得很！', requireChoice: true,
      options: [
        { id: 'apologize', text: '不好意思，我就是想多了解...', trapScore: 15, nextNodeId: 'urgency' },
        { id: 'leave', text: '那算了，再见', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'urgency', type: 'npc', speaker: '招商经理', content: '我跟您说，这个优惠活动马上截止了，您那个市的名额只剩最后2个！昨天有个客户犹豫了一天，今天再打电话名额就没了！', requireChoice: false, nextNodeId: 'countdown', effect: { type: 'countdown' } },
    { id: 'countdown', type: 'system', content: '【优惠倒计时：2小时59分】', requireChoice: true,
      options: [
        { id: 'rush', text: '那我现在就定！', trapScore: 35, nextNodeId: 'end_trapped' },
        { id: 'think', text: '我要和家人商量一下...', trapScore: 10, nextNodeId: 'pressure' },
        { id: 'see_through', text: '这种倒计时套路我见多了', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'pressure', type: 'npc', speaker: '招商经理', content: '商量？创业这种事商量来商量去机会就没了！马云、刘强东哪个是商量出来的？您今天定，我私人帮您申请额外3万物料补贴！', requireChoice: true,
      options: [
        { id: 'sign', text: '好吧，那就定了！', trapScore: 30, nextNodeId: 'end_trapped' },
        { id: 'resist', text: '不行，我必须考虑清楚', trapScore: 0, nextNodeId: 'visit' },
      ],
    },
    { id: 'visit', type: 'system', content: '【三天后，济南某写字楼】\n专车接送 ✓ 五星酒店 ✓ 样板间试饮 ✓', requireChoice: false, nextNodeId: 'visit_npc' },
    { id: 'visit_npc', type: 'npc', speaker: '商务经理', content: '来，尝尝我们的招牌哪吒冰沙！这联名杯多好看，发朋友圈绝对爆！现在签约送价值3万开业物料包！', requireChoice: true,
      options: [
        { id: 'sign_visit', text: '看起来不错，我签了', trapScore: 30, nextNodeId: 'end_trapped' },
        { id: 'ask_store', text: '能带我去看实际营业的门店吗？', trapScore: 0, nextNodeId: 'refuse_store' },
      ],
    },
    { id: 'refuse_store', type: 'npc', speaker: '商务经理', content: '（脸色一变）门店地址是商业机密。您都来总部了还不信任我们？这优惠今天截止，您走了明天就是原价！', requireChoice: true,
      options: [
        { id: 'pressured', text: '好吧，我签...', trapScore: 25, nextNodeId: 'end_trapped' },
        { id: 'final_refuse', text: '那就算了', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'end_trapped', type: 'system', content: '你签下了加盟合同...', requireChoice: false, nextNodeId: null },
    { id: 'end_normal', type: 'system', content: '你挂断了电话，决定继续寻找正规品牌...', requireChoice: false, nextNodeId: null },
  ];
}

// ========== 塔斯汀剧情：第四代汉堡革命套路 ==========
function generateTastienDialogue(): DialogueNode[] {
  return [
    { id: 'start', type: 'system', content: '你在抖音刷到一条"塔斯汀加盟"的广告，点击了咨询链接...', requireChoice: false, nextNodeId: 'add_wechat' },
    { id: 'add_wechat', type: 'system', content: '对方添加了你的微信...', requireChoice: false, nextNodeId: 'npc1' },
    { id: 'npc1', type: 'npc', speaker: '招商顾问', content: '您好！看到您对塔斯汀感兴趣，请问您在哪个城市？有多少启动资金？', requireChoice: false, nextNodeId: 'player1' },
    { id: 'player1', type: 'player', content: '我在XX市，准备了30多万。', requireChoice: false, nextNodeId: 'npc2' },
    { id: 'npc2', type: 'npc', speaker: '招商顾问', content: '30万的话...塔斯汀现在加盟门槛提高了，光加盟费就要32万，还不算装修设备。而且您那个城市竞争太激烈了，华莱士、肯德基都在，新店很难存活...', requireChoice: false, nextNodeId: 'player2' },
    { id: 'player2', type: 'player', content: '那怎么办？我就想做汉堡生意...', requireChoice: false, nextNodeId: 'npc3' },
    {
      id: 'npc3', type: 'npc', speaker: '招商顾问',
      content: '我给您推荐一个更好的选择——【燃熊中国汉堡】！这是塔斯汀核心高管出来创立的，号称"第四代汉堡革命"，产品比塔斯汀更好，加盟费才16.8万！',
      requireChoice: true,
      options: [
        { id: 'interested', text: '第四代汉堡？什么意思？', trapScore: 25, nextNodeId: 'explain_4th' },
        { id: 'doubt', text: '高管出来单干？塔斯汀知道吗？', trapScore: 10, nextNodeId: 'npc_dodge' },
        { id: 'refuse', text: '没听过这牌子，算了', trapScore: 0, nextNodeId: 'npc_persist' },
      ],
    },
    { id: 'explain_4th', type: 'npc', speaker: '招商顾问', content: '第一代是麦当劳，第二代是华莱士，第三代是塔斯汀，第四代就是燃熊！我们用的是现烤堡胚、秘制酱料，口感完爆塔斯汀！三年内必超塔斯汀！', requireChoice: true,
      options: [
        { id: 'believe', text: '听起来很有前景！', trapScore: 25, nextNodeId: 'show_data' },
        { id: 'question', text: '有什么数据支撑吗？', trapScore: 5, nextNodeId: 'show_data' },
      ],
    },
    { id: 'npc_dodge', type: 'npc', speaker: '招商顾问', content: '这个...人往高处走嘛，核心团队看好新赛道很正常。而且燃熊的产品确实比塔斯汀好，您尝过就知道了！', requireChoice: true,
      options: [
        { id: 'ok', text: '那我了解一下', trapScore: 20, nextNodeId: 'show_data' },
        { id: 'still_doubt', text: '我还是想加盟正规品牌', trapScore: 0, nextNodeId: 'npc_persist' },
      ],
    },
    { id: 'npc_persist', type: 'npc', speaker: '招商顾问', content: '您想想，塔斯汀旁边开个燃熊，用更好的产品、更低的价格，把塔斯汀的客人都抢过来！这不比加盟塔斯汀强？', requireChoice: true,
      options: [
        { id: 'tempted', text: '这么说也有道理...', trapScore: 25, nextNodeId: 'show_data' },
        { id: 'firm', text: '不了，谢谢', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'show_data', type: 'system', content: '对方发来一组"门店数据"截图...', requireChoice: false, nextNodeId: 'data_npc', effect: { type: 'highlight' } },
    { id: 'data_npc', type: 'npc', speaker: '招商顾问', content: '您看，这是我们郑州门店的数据，日均营业额3500+！开在华莱士旁边，直接把华莱士干趴下了！', requireChoice: true,
      options: [
        { id: 'excited', text: '这数据太猛了！', trapScore: 30, nextNodeId: 'urgency' },
        { id: 'verify', text: '我能去这家店实地看看吗？', trapScore: 0, nextNodeId: 'no_visit' },
      ],
    },
    { id: 'no_visit', type: 'npc', speaker: '招商顾问', content: '那家店老板不太配合考察...不过您可以来总部，我们有试吃体验，您尝了产品就知道好不好了！', requireChoice: true,
      options: [
        { id: 'go', text: '行，我去总部看看', trapScore: 20, nextNodeId: 'visit' },
        { id: 'suspicious', text: '连门店都不让看，我不放心', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'urgency', type: 'npc', speaker: '招商顾问', content: '现在签约还有优惠！原价32万，现在只要16.8万，还送价值5万的开业大礼包！但这个价格今天截止！', requireChoice: false, nextNodeId: 'countdown', effect: { type: 'countdown' } },
    { id: 'countdown', type: 'system', content: '【限时优惠：今日截止】', requireChoice: true,
      options: [
        { id: 'rush', text: '这价格太划算了，我定了！', trapScore: 35, nextNodeId: 'end_trapped' },
        { id: 'think', text: '让我考虑一下...', trapScore: 10, nextNodeId: 'pressure' },
        { id: 'refuse', text: '我不相信这种限时优惠', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'pressure', type: 'npc', speaker: '招商顾问', content: '考虑什么？您那个城市已经有3个人在问了，名额就剩1个！您不签别人就签了！', requireChoice: true,
      options: [
        { id: 'sign', text: '好，那我签！', trapScore: 30, nextNodeId: 'end_trapped' },
        { id: 'resist', text: '那让他们签吧', trapScore: 0, nextNodeId: 'visit' },
      ],
    },
    { id: 'visit', type: 'system', content: '【两天后，郑州某商业区】\n你来到了燃熊总部...', requireChoice: false, nextNodeId: 'visit_npc' },
    { id: 'visit_npc', type: 'npc', speaker: '培训师', content: '来，尝尝我们的招牌燃熊堡！这堡胚是现烤的，比塔斯汀的冷冻堡胚好吃多了！', requireChoice: true,
      options: [
        { id: 'taste_good', text: '确实好吃，我签了', trapScore: 30, nextNodeId: 'end_trapped' },
        { id: 'ask_store', text: '能带我去看正在营业的门店吗？', trapScore: 0, nextNodeId: 'refuse_visit' },
      ],
    },
    { id: 'refuse_visit', type: 'npc', speaker: '培训师', content: '门店都在忙，不方便打扰。您产品都尝了，还有什么不放心的？今天签约还能赶上这波优惠！', requireChoice: true,
      options: [
        { id: 'pressured', text: '好吧，签了', trapScore: 25, nextNodeId: 'end_trapped' },
        { id: 'final_refuse', text: '不看门店我不签', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'end_trapped', type: 'system', content: '你签下了加盟合同...', requireChoice: false, nextNodeId: null },
    { id: 'end_normal', type: 'system', content: '你离开了，决定继续寻找正规品牌...', requireChoice: false, nextNodeId: null },
  ];
}

// ========== 瑞幸咖啡剧情：韩国高端品牌套路 ==========
function generateLuckinDialogue(): DialogueNode[] {
  return [
    { id: 'start', type: 'system', content: '你在小红书看到"瑞幸咖啡加盟"的帖子，私信了博主...', requireChoice: false, nextNodeId: 'reply' },
    { id: 'reply', type: 'system', content: '博主回复了你一个微信号...', requireChoice: false, nextNodeId: 'npc1' },
    { id: 'npc1', type: 'npc', speaker: '投资顾问', content: '您好，我是瑞幸咖啡的投资顾问。请问您对咖啡行业有了解吗？准备投资多少？', requireChoice: false, nextNodeId: 'player1' },
    { id: 'player1', type: 'player', content: '有一些了解，准备投40-50万左右。', requireChoice: false, nextNodeId: 'npc2' },
    { id: 'npc2', type: 'npc', speaker: '投资顾问', content: '（沉默片刻）实话跟您说，瑞幸现在不对外开放加盟了，只做联营模式，门槛至少100万起，而且要有餐饮经验...', requireChoice: false, nextNodeId: 'player2' },
    { id: 'player2', type: 'player', content: '100万？那我资金不够啊...', requireChoice: false, nextNodeId: 'npc3' },
    {
      id: 'npc3', type: 'npc', speaker: '投资顾问',
      content: '不过我这边有个更好的项目——【清潭洞咖啡】，韩国顶级咖啡品牌，刚进入中国市场。高端定位，客单价45元起，比瑞幸利润高多了！而且只要45万就能做城市代理！',
      requireChoice: true,
      options: [
        { id: 'interested', text: '韩国品牌？听起来很高端', trapScore: 25, nextNodeId: 'explain_brand' },
        { id: 'doubt', text: '没听说过这个牌子啊', trapScore: 10, nextNodeId: 'npc_prove' },
        { id: 'refuse', text: '我只想做瑞幸', trapScore: 0, nextNodeId: 'npc_persist' },
      ],
    },
    { id: 'explain_brand', type: 'npc', speaker: '投资顾问', content: '清潭洞是韩国首尔最顶级的富人区，这个品牌在韩国有200多家店，李敏镐都是常客！现在首次进入中国，杭州首店开业当天排队3小时，日营业额破2万！', requireChoice: true,
      options: [
        { id: 'believe', text: '李敏镐？那确实很火！', trapScore: 30, nextNodeId: 'show_video' },
        { id: 'question', text: '有什么证据吗？', trapScore: 5, nextNodeId: 'show_video' },
      ],
    },
    { id: 'npc_prove', type: 'npc', speaker: '投资顾问', content: '您可以搜一下，小红书上很多人打卡的！韩国明星同款咖啡，年轻女孩最爱这种调调。而且我们是独家代理，全国只开放100个城市！', requireChoice: true,
      options: [
        { id: 'ok', text: '那我了解一下', trapScore: 20, nextNodeId: 'show_video' },
        { id: 'still_doubt', text: '我还是想做大品牌', trapScore: 0, nextNodeId: 'npc_persist' },
      ],
    },
    { id: 'npc_persist', type: 'npc', speaker: '投资顾问', content: '瑞幸现在9.9元一杯，利润太薄了。清潭洞客单价45元，一杯顶瑞幸五杯！而且高端客群复购率高，不用打价格战！', requireChoice: true,
      options: [
        { id: 'tempted', text: '高端定位确实利润高...', trapScore: 25, nextNodeId: 'show_video' },
        { id: 'firm', text: '算了，我再考虑考虑', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'show_video', type: 'system', content: '对方发来一段"杭州首店"的视频，门口排着长队...', requireChoice: false, nextNodeId: 'video_npc', effect: { type: 'highlight' } },
    { id: 'video_npc', type: 'npc', speaker: '投资顾问', content: '您看这排队的人！开业三天营业额破6万！这还是淡季，等网红效应发酵，日均破3万不是问题！', requireChoice: true,
      options: [
        { id: 'excited', text: '这人气太火爆了！', trapScore: 30, nextNodeId: 'price_talk' },
        { id: 'verify', text: '我能去杭州这家店看看吗？', trapScore: 0, nextNodeId: 'no_visit' },
      ],
    },
    { id: 'no_visit', type: 'npc', speaker: '投资顾问', content: '杭州店是直营样板店，不对外开放考察。不过您可以来上海总部，我们有完整的品牌展厅和产品体验区！', requireChoice: true,
      options: [
        { id: 'go', text: '好，我去上海看看', trapScore: 20, nextNodeId: 'visit' },
        { id: 'suspicious', text: '样板店都不让看？', trapScore: 0, nextNodeId: 'npc_explain_why' },
      ],
    },
    { id: 'npc_explain_why', type: 'npc', speaker: '投资顾问', content: '不是不让看，是怕影响正常营业。您想想，天天有人来考察，顾客体验会下降的。我们对品牌形象要求很高！', requireChoice: true,
      options: [
        { id: 'understand', text: '说得也是，那我去总部', trapScore: 15, nextNodeId: 'visit' },
        { id: 'leave', text: '我再想想吧', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'price_talk', type: 'npc', speaker: '投资顾问', content: '现在做城市代理，原价60万，首批合作伙伴优惠价45万！而且您是城市独家，整个市就您一家清潭洞！', requireChoice: false, nextNodeId: 'urgency', effect: { type: 'countdown' } },
    { id: 'urgency', type: 'system', content: '【城市代理名额：仅剩3个】', requireChoice: true,
      options: [
        { id: 'rush', text: '独家代理？那我要定下来！', trapScore: 35, nextNodeId: 'end_trapped' },
        { id: 'think', text: '45万不是小数目，我要考虑...', trapScore: 10, nextNodeId: 'pressure' },
        { id: 'refuse', text: '这种饥饿营销我不吃', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'pressure', type: 'npc', speaker: '投资顾问', content: '您隔壁市昨天刚签了，人家二话不说直接打款。您这个市位置好，已经有两个人在问了，您不签他们就签了！', requireChoice: true,
      options: [
        { id: 'sign', text: '行，我签！不能让别人抢了', trapScore: 30, nextNodeId: 'end_trapped' },
        { id: 'resist', text: '让他们签吧，我不着急', trapScore: 0, nextNodeId: 'visit' },
      ],
    },
    { id: 'visit', type: 'system', content: '【一周后，上海某高档写字楼】\n你来到了清潭洞咖啡中国总部...', requireChoice: false, nextNodeId: 'visit_npc' },
    { id: 'visit_npc', type: 'npc', speaker: '品牌总监', content: '欢迎来到清潭洞！来，尝尝我们的招牌清潭洞拿铁，用的是韩国进口咖啡豆，口感绝对不一样！', requireChoice: true,
      options: [
        { id: 'taste_good', text: '确实好喝，很有韩国feel', trapScore: 25, nextNodeId: 'sign_pressure' },
        { id: 'ask_store', text: '能带我去看正在营业的门店吗？', trapScore: 0, nextNodeId: 'refuse_visit' },
      ],
    },
    { id: 'sign_pressure', type: 'npc', speaker: '品牌总监', content: '您眼光真好！现在签约还能赶上春季开业黄金期，我们提供全套韩式装修方案，保证您的店成为当地网红打卡点！', requireChoice: true,
      options: [
        { id: 'sign_now', text: '好，我现在就签', trapScore: 30, nextNodeId: 'end_trapped' },
        { id: 'still_ask', text: '我还是想看看实际门店', trapScore: 0, nextNodeId: 'refuse_visit' },
      ],
    },
    { id: 'refuse_visit', type: 'npc', speaker: '品牌总监', content: '（表情微变）门店都在筹备期，暂时没有可以参观的。您都来总部了，产品也尝了，还有什么不放心的？今天签约送价值8万的韩式装修升级包！', requireChoice: true,
      options: [
        { id: 'pressured', text: '好吧，那就签了', trapScore: 25, nextNodeId: 'end_trapped' },
        { id: 'final_refuse', text: '没有营业门店我不签', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'end_trapped', type: 'system', content: '你签下了城市代理合同...', requireChoice: false, nextNodeId: null },
    { id: 'end_normal', type: 'system', content: '你离开了，决定继续寻找正规品牌...', requireChoice: false, nextNodeId: null },
  ];
}

// ========== 茶百道剧情：网红升级版套路 ==========
function generateChabaidaoDialogue(): DialogueNode[] {
  return [
    { id: 'start', type: 'system', content: '你在美团上搜索"茶百道加盟"，找到了一个招商电话...', requireChoice: false, nextNodeId: 'call' },
    { id: 'call', type: 'system', content: '📞 电话接通了', requireChoice: false, nextNodeId: 'npc1' },
    { id: 'npc1', type: 'npc', speaker: '招商专员', content: '您好，茶百道招商中心，请问您想咨询加盟吗？', requireChoice: false, nextNodeId: 'player1' },
    { id: 'player1', type: 'player', content: '是的，我想在我们县城开一家茶百道。', requireChoice: false, nextNodeId: 'npc2' },
    { id: 'npc2', type: 'npc', speaker: '招商专员', content: '县城啊...（翻资料的声音）不好意思，茶百道目前主攻一二线城市，县城暂时不开放加盟。而且现在加盟费涨到28万了，审核也很严格...', requireChoice: false, nextNodeId: 'player2' },
    { id: 'player2', type: 'player', content: '啊？县城不能开吗？那我怎么办...', requireChoice: false, nextNodeId: 'npc3' },
    {
      id: 'npc3', type: 'npc', speaker: '招商专员',
      content: '这样，我给您推荐一个更适合县城的品牌——【哪吒仙饮】！这是我们集团专门为下沉市场打造的，产品配方和茶百道一样，但加盟费只要15.8万，专门针对县城市场！',
      requireChoice: true,
      options: [
        { id: 'interested', text: '配方一样？那不就是茶百道吗？', trapScore: 25, nextNodeId: 'explain_brand' },
        { id: 'doubt', text: '没听说过这个牌子', trapScore: 10, nextNodeId: 'npc_prove' },
        { id: 'refuse', text: '我就想开茶百道', trapScore: 0, nextNodeId: 'npc_persist' },
      ],
    },
    { id: 'explain_brand', type: 'npc', speaker: '招商专员', content: '可以这么理解！哪吒仙饮就是茶百道的"县城版"，用的是同一个研发团队、同样的供应链。只是品牌定位不同，价格更亲民，更适合县城消费水平！', requireChoice: true,
      options: [
        { id: 'believe', text: '原来是这样，那挺好的', trapScore: 30, nextNodeId: 'show_case' },
        { id: 'question', text: '为什么不直接用茶百道的牌子？', trapScore: 5, nextNodeId: 'npc_explain' },
      ],
    },
    { id: 'npc_explain', type: 'npc', speaker: '招商专员', content: '这是品牌战略！茶百道要保持高端形象，不能开到县城去。但县城市场这么大，总部不想放弃，所以推出哪吒仙饮专攻下沉市场，这叫"双品牌战略"！', requireChoice: true,
      options: [
        { id: 'understand', text: '有道理，大品牌都这么玩', trapScore: 25, nextNodeId: 'show_case' },
        { id: 'still_doubt', text: '我还是想开正牌茶百道', trapScore: 0, nextNodeId: 'npc_persist' },
      ],
    },
    { id: 'npc_prove', type: 'npc', speaker: '招商专员', content: '哪吒仙饮是今年刚推出的，主打《哪吒3》联名，在抖音上特别火！您搜一下，很多网红都在推。而且县城竞争小，先开先赚！', requireChoice: true,
      options: [
        { id: 'ok', text: '抖音上火？那我了解一下', trapScore: 20, nextNodeId: 'show_case' },
        { id: 'still_doubt', text: '我还是想开大品牌', trapScore: 0, nextNodeId: 'npc_persist' },
      ],
    },
    { id: 'npc_persist', type: 'npc', speaker: '招商专员', content: '您想想，县城开茶百道，客单价20多块，当地人消费不起。哪吒仙饮客单价12-15块，更接地气！而且您是县城第一家，独占市场！', requireChoice: true,
      options: [
        { id: 'tempted', text: '县城第一家？那确实有优势', trapScore: 25, nextNodeId: 'show_case' },
        { id: 'firm', text: '算了，我再看看别的', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'show_case', type: 'system', content: '对方发来几张"成功案例"的照片...', requireChoice: false, nextNodeId: 'case_npc', effect: { type: 'highlight' } },
    { id: 'case_npc', type: 'npc', speaker: '招商专员', content: '您看，这是河南某县城的加盟商，开业第一个月营业额就破8万！县城租金低、人工便宜，利润比城市还高！', requireChoice: true,
      options: [
        { id: 'excited', text: '一个月8万？这么赚钱！', trapScore: 30, nextNodeId: 'urgency' },
        { id: 'verify', text: '我能联系这个加盟商聊聊吗？', trapScore: 0, nextNodeId: 'no_contact' },
      ],
    },
    { id: 'no_contact', type: 'npc', speaker: '招商专员', content: '这个...加盟商都很忙，不太方便打扰。不过您可以来成都总部考察，我们有完整的培训基地，还能试喝全系列产品！', requireChoice: true,
      options: [
        { id: 'go', text: '好，我去成都看看', trapScore: 20, nextNodeId: 'visit' },
        { id: 'suspicious', text: '连加盟商都不让联系？', trapScore: 0, nextNodeId: 'npc_excuse' },
      ],
    },
    { id: 'npc_excuse', type: 'npc', speaker: '招商专员', content: '不是不让联系，是保护加盟商隐私。您想想，天天有人打电话问东问西，人家还做不做生意了？我们有专业的考察流程！', requireChoice: true,
      options: [
        { id: 'accept', text: '也是，那我去总部看', trapScore: 15, nextNodeId: 'visit' },
        { id: 'leave', text: '我再考虑考虑', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'urgency', type: 'npc', speaker: '招商专员', content: '现在加盟还有优惠！原价25.8万，现在只要15.8万！而且您那个县还没人签，您签了就是独家！但这个价格只限本周！', requireChoice: false, nextNodeId: 'countdown', effect: { type: 'countdown' } },
    { id: 'countdown', type: 'system', content: '【县城独家名额：仅剩1个】', requireChoice: true,
      options: [
        { id: 'rush', text: '独家？那我必须抢到！', trapScore: 35, nextNodeId: 'end_trapped' },
        { id: 'think', text: '我要回去和家人商量...', trapScore: 10, nextNodeId: 'pressure' },
        { id: 'refuse', text: '这种套路我见多了', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'pressure', type: 'npc', speaker: '招商专员', content: '商量什么？您隔壁县昨天刚签了，人家老婆都没商量！创业要果断，机会不等人！您今天定，我帮您申请额外的开业扶持金！', requireChoice: true,
      options: [
        { id: 'sign', text: '好，那就定了！', trapScore: 30, nextNodeId: 'end_trapped' },
        { id: 'resist', text: '不行，我必须考虑清楚', trapScore: 0, nextNodeId: 'visit' },
      ],
    },
    { id: 'visit', type: 'system', content: '【五天后，成都某写字楼】\n你来到了哪吒仙饮总部...', requireChoice: false, nextNodeId: 'visit_npc' },
    { id: 'visit_npc', type: 'npc', speaker: '培训经理', content: '欢迎来到哪吒仙饮！来，尝尝我们的招牌哪吒冰沙，这个配方和茶百道的杨枝甘露是同一个研发团队做的！', requireChoice: true,
      options: [
        { id: 'taste_good', text: '确实好喝，和茶百道差不多', trapScore: 25, nextNodeId: 'sign_pressure' },
        { id: 'ask_store', text: '能带我去看实际营业的门店吗？', trapScore: 0, nextNodeId: 'refuse_visit' },
      ],
    },
    { id: 'sign_pressure', type: 'npc', speaker: '培训经理', content: '对吧！配方都是一样的！现在签约还送全套设备，价值3万！您县城的名额真的很抢手，今天不签明天可能就没了！', requireChoice: true,
      options: [
        { id: 'sign_now', text: '送设备？那我签了', trapScore: 30, nextNodeId: 'end_trapped' },
        { id: 'still_ask', text: '我还是想看看门店', trapScore: 0, nextNodeId: 'refuse_visit' },
      ],
    },
    { id: 'refuse_visit', type: 'npc', speaker: '培训经理', content: '（脸色一沉）门店都在外地，来回要两天。您都来总部了，产品也尝了，培训基地也看了，还有什么不放心的？', requireChoice: true,
      options: [
        { id: 'pressured', text: '好吧，那就签了', trapScore: 25, nextNodeId: 'end_trapped' },
        { id: 'final_refuse', text: '不看门店我不签', trapScore: 0, nextNodeId: 'end_normal' },
      ],
    },
    { id: 'end_trapped', type: 'system', content: '你签下了加盟合同...', requireChoice: false, nextNodeId: null },
    { id: 'end_normal', type: 'system', content: '你离开了，决定继续寻找正规品牌...', requireChoice: false, nextNodeId: null },
  ];
}

// ========== 导出函数：根据品牌生成对话流程 ==========
export function generateDialogueFlow(brandName: string, _quickBrandName: string): DialogueNode[] {
  void _quickBrandName;
  // 根据品牌名称选择对应的剧情
  const brandDialogueMap: Record<string, () => DialogueNode[]> = {
    '蜜雪冰城': generateMixueDialogue,
    '塔斯汀': generateTastienDialogue,
    '瑞幸咖啡': generateLuckinDialogue,
    '茶百道': generateChabaidaoDialogue,
  };

  const dialogueGenerator = brandDialogueMap[brandName];
  if (dialogueGenerator) {
    return dialogueGenerator();
  }

  // 默认使用蜜雪冰城的剧情模板
  return generateMixueDialogue();
}
