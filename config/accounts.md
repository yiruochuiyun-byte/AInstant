# 重点账号清单 v1（X）

用途：Grok bot 盯这些账号，把相关帖子推到 `POST /api/ingest`；“默认可信度”决定条目在网站上的可信度标签。
整理于 2026-10-25。“核实”一列：✓ = 本次在公开网页上看到了这个 handle；? = 凭已有知识，接入前请在 X 上确认一次。

默认可信度：official = 官方确认（公司或产品官方账号、本人宣布自家产品）；media = 媒体报道/实测/评论；rumor = 传闻（爆料账号，在网站上一律标“传闻”）。

## 1. 公司与产品官方账号（official）

| 账号 | 是谁 | 核实 |
| --- | --- | --- |
| @OpenAI | OpenAI 官方 | ✓ |
| @OpenAIDevs | OpenAI 开发者（API、Codex 更新） | ? |
| @AnthropicAI | Anthropic 官方 | ✓ |
| @claudeai | Claude 产品账号 | ? |
| @GoogleDeepMind | Google DeepMind 官方 | ✓ |
| @GoogleAIStudio | Google AI Studio / Gemini API | ? |
| @AIatMeta | Meta AI（Muse 系列） | ✓ |
| @MistralAI | Mistral AI | ✓ |
| @xai | xAI 官方 | ? |
| @huggingface | Hugging Face | ✓ |
| @NVIDIAAI | NVIDIA AI | ✓ |
| @perplexity_ai | Perplexity | ✓ |
| @cohere | Cohere | ✓ |
| @cursor_ai | Cursor | ? |
| @github | GitHub（Copilot 更新） | ? |
| @deepseek_ai | DeepSeek（官方声明的唯一 X 账号） | ✓ |
| @Alibaba_Qwen | 通义千问 Qwen | ✓ |
| @Kimi_Moonshot | Kimi / 月之暗面 | ✓ |
| @Zai_org | Z.ai（智谱 GLM） | ✓ |
| @MiniMax__AI | MiniMax（注意两个下划线） | ✓ |
| @Hailuo_AI | 海螺 AI（MiniMax 视频） | ✓ |
| @TencentHunyuan | 腾讯混元 | ✓ |

## 2. 创始人与高管（发布自家产品时算 official，其他算 media）

| 账号 | 是谁 | 核实 |
| --- | --- | --- |
| @sama | Sam Altman，OpenAI CEO | ✓ |
| @gdb | Greg Brockman，OpenAI | ✓ |
| @DarioAmodei | Dario Amodei，Anthropic CEO | ✓ |
| @demishassabis | Demis Hassabis，Google DeepMind | ✓ |
| @OfficialLoganK | Logan Kilpatrick，Gemini API 产品负责人 | ? |
| @ClementDelangue | Clément Delangue，Hugging Face CEO | ✓ |
| @arthurmensch | Arthur Mensch，Mistral CEO | ✓ |
| @AravSrinivas | Aravind Srinivas，Perplexity CEO | ✓ |
| @miramurati | Mira Murati，Thinking Machines Lab | ✓ |
| @mustafasuleyman | Mustafa Suleyman，Microsoft AI | ✓ |
| @ilyasut | Ilya Sutskever，SSI | ✓ |
| @elonmusk | Elon Musk，xAI（噪音大，只收 AI 相关） | ? |
| @jietang | 唐杰，智谱首席科学家 | ✓ |

## 3. 研究员与技术解读（media）

| 账号 | 是谁 | 核实 |
| --- | --- | --- |
| @karpathy | Andrej Karpathy | ✓ |
| @ylecun | Yann LeCun | ✓ |
| @DrJimFan | Jim Fan，NVIDIA 机器人 | ✓ |
| @natolambert | Nathan Lambert，开源模型与后训练 | ✓ |
| @rasbt | Sebastian Raschka，模型架构解读 | ✓ |
| @polynoamial | Noam Brown，OpenAI 推理 | ✓ |
| @fchollet | François Chollet，ARC-AGI | ✓ |
| @ch402 | Chris Olah，Anthropic 可解释性 | ✓ |
| @hardmaru | David Ha，Sakana AI | ✓ |
| @drfeifei | 李飞飞，World Labs | ✓ |
| @_akhaliq | AK，每日论文 | ✓ |
| @ggerganov | llama.cpp 作者，本地推理 | ✓ |

## 4. 实测与测评（media）

| 账号 | 是谁 | 核实 |
| --- | --- | --- |
| @simonw | Simon Willison，新模型上手实测 | ✓ |
| @ArtificialAnlys | Artificial Analysis，独立评测与价格 | ✓ |
| @arena | Arena（原 LMArena），匿名对战榜 | ✓ |
| @EpochAIResearch | Epoch AI，算力与基准 | ? |
| @emollick | Ethan Mollick，应用实测 | ✓ |
| @swyx | swyx，Latent Space | ✓ |
| @HamelHusain | Hamel Husain，评测方法 | ✓ |
| @AISecurityInst | 英国 AI 安全研究所（安全事件） | ✓ |
| @BethMayBarnes | METR，前沿模型独立评估 | ✓ |
| @MariusHobbhahn | Apollo Research，模型欺骗与安全评估 | ✓ |

## 5. 爆料与早期消息（rumor：一律标“传闻”，等官方确认）

| 账号 | 是谁 | 核实 |
| --- | --- | --- |
| @testingcatalog | TestingCatalog，代码字符串和灰度功能 | ✓ |
| @btibor91 | Tibor Blaho，App 代码爆料 | ? |
| @apples_jimmy | Jimmy Apples，OpenAI 内幕 | ✓ |
| @kimmonismus | Chubby，汇总和评论（转述多，需回溯原始来源） | ✓ |
| @chetaslua | Chetaslua，Arena 匿名模型猜测 | ✓ |

## 6. 中文圈（X 上的中文账号；微博、即刻、知乎账号待补，见下）

| 账号 | 是谁 | 核实 |
| --- | --- | --- |
| @op7418 | 歸藏，AI 产品与工具 | ? |
| @dotey | 宝玉，翻译与解读 | ? |
| @lufzzliz | 岚叔 | ✓ |

待补：微博、即刻、知乎、小红书上的中国 AI 公司官方号和创始人账号（DeepSeek 官方只有微信公众号、小红书 @DeepSeek 和 X @deepseek_ai）。这部分建议你按自己日常关注的列一下，我再把它们配成 RSSHub 路由。

## Grok bot 怎么接

1. 每发现一条相关帖子（或一批），POST 到 `https://<网站域名>/api/ingest`，请求头 `Authorization: Bearer <INGEST_TOKEN>`。
2. 内容是 JSON，单条或数组都行：`{"url": "https://x.com/<账号>/status/<id>", "title": "帖子一句话概括", "note": "可选：为什么相关", "author": "<账号>", "lang": "en 或 zh"}`。
3. 只推原帖链接，不要推截图或全文；转发的帖子请推原始帖子。
4. 过滤建议：只推与模型、工具、平台、开源、安全事件、测评相关的帖子；融资和政策类不推（管线也会过滤）。

参考：同类中文站 AI热报（airebao.com）已在做“多信源确认 + 精选理由”的形式，可以留意对方的信源和呈现方式。
