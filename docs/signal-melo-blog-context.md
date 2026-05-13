# SignalMelo — short brief for the blog

Copy this into your blog repo (e.g. NotionNext `docs/`) so writers and tools share the same facts.

---

## What it is

**SignalMelo** is a **social listening and social media monitoring** web app for teams. It brings community threads, video/visual signals, and **search / demand** clues into one workflow, with AI help to **surface high-intent opportunities** so you act on what matters—not endless tabs and raw mention volume.

**One line:** Turn social and search signals into clear growth decisions.

(Same product as the **GreatDecisionMaker** codebase; the public brand is **SignalMelo**.)

---

## Who it’s for

**Growth teams, marketers, indie founders, SaaS teams, and anyone doing community or social ops** who need multi-channel listening without drowning in noise, and who want to **prioritize before they reply**.

---

## Keywords (for drafts / SEO)

social listening, social media monitoring, AI, growth teams, community threads, high-intent signals, Discussions, Discovery, SEO Radar, SignalMelo

---

## Website and contact

- **Site:** https://signalmelo.com  
- **Support:** support@signalmelo.com  

(Social links follow the live site footer; env overrides apply in production.)

---

## Notion 站点配置表（NotionNext）

以下行若要让站点读取，**「启用」列必须为 `Yes`**（与 `getNotionConfig.js` 里 `=== 'Yes'` 一致）；未勾选则整行**不会**合并进 `NOTION_CONFIG`。

| 配置名 | 配置值示例 | 说明 |
|--------|------------|------|
| `LANG` | `en-US` | 界面语言；不设则沿用 `NEXT_PUBLIC_LANG` / `blog.config.js`。 |
| `LINK` | `https://www.signalmelo.com` | 与 Vercel 生产域名一致（含 `www`）。 |
| `FUWARI_WIDGET_CONTACT` | `false` | 关闭侧栏「社区 / 联系」卡片。 |
| `FUWARI_WIDGET_ANALYTICS` | `false` | 关闭侧栏「统计」三格卡片。 |
| `THEME` | `fuwari` | 可选；与 env 二选一时注意优先级。 |

布尔值在配置值里写 **`false`** / **`true`**（可被解析为 JSON）；其它 Fuwari 键见 `themes/fuwari/config.js` 注释，同名即可在表中覆盖。
