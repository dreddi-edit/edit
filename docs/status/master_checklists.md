# Reframe Master Checklists

Stand: 2026-03-13

## A) 200 Feature Inventory

Quelle: nach status/master_checklists.md migriert (urspruenglich reframe_200_feature_inventory.md)

# Reframe – Full Feature Inventory (Approx. 200 Features)

## 1. Authentication & Accounts
1. User registration
2. Email login
3. Password reset
4. Forgot password flow
5. Session restore
6. Logout
7. Account settings
8. Profile management
9. Email verification
10. Security logs

## 2. Plans, Credits & Billing
11. Plan tiers
12. Credit balance
13. Credit deduction for AI usage
14. Transaction history
15. Top-up credits
16. Admin plan changes
17. Usage tracking
18. Cost estimation
19. AI cost attribution per project
20. Billing overview

## 3. Dashboard / Workspace
21. Project dashboard
22. Template dashboard
23. Export dashboard
24. AI Studio dashboard
25. Search projects
26. Pin projects
27. Delete projects
28. Restore projects
29. Duplicate projects
30. Project sorting

## 4. Project Management
31. Create project
32. Import project from URL
33. Import project ZIP
34. Multi-page projects
35. Page list view
36. Internal link scanner
37. Project metadata
38. Client names
39. Due dates
40. Assignees

## 5. Editor – Core
41. Visual editor iframe
42. Block selection
43. Block highlighting
44. Drag-and-drop blocks
45. Component library
46. Edit inline text
47. Edit attributes
48. DOM tree parsing
49. Structure panel
50. Live preview

## 6. Editor – Layout & Styles
51. Layout inspector
52. Style overrides
53. CSS variable extraction
54. Font detection
55. Asset management
56. Image replacement
57. Responsive preview
58. Desktop viewport
59. Tablet viewport
60. Mobile viewport

## 7. Editor – Versioning
61. Snapshot creation
62. Version history
63. Version restore
64. Version comparison
65. Diff preview
66. Change tracking
67. Workflow history
68. Publish history
69. Rollback deployment
70. Audit log

## 8. AI Studio – Core
71. AI Studio workspace
72. Multi-model execution
73. Agent chaining
74. Prompt templating
75. Streaming responses
76. Credit cost estimation
77. AI run history
78. Agent audit logs
79. AI suggestions
80. Auto-apply changes

## 9. AI Studio – Content Tools
81. Rewrite copy
82. Improve readability
83. Tone adjustment
84. Conversion copy suggestions
85. Headline generator
86. CTA improvement
87. Product description rewrite
88. Blog rewrite
89. Email copy generation
90. Ad copy suggestions

## 10. AI Studio – CRO
91. CRO audit
92. Conversion suggestions
93. UX friction detection
94. Funnel analysis
95. CTA placement advice
96. Hero section optimization
97. Landing page scoring
98. A/B experiment ideas
99. CRO checklist
100. Optimization summary

## 11. AI Studio – SEO
101. SEO audit
102. Meta title generation
103. Meta description generation
104. Keyword suggestions
105. Content gap analysis
106. Structured data suggestions
107. Internal linking suggestions
108. SEO score
109. Page optimization suggestions
110. Search snippet preview

## 12. AI Studio – Translation
111. Multi-language translation
112. Segment extraction
113. Translation overrides
114. Language switching
115. Language variant preview
116. Translation memory
117. Batch translation
118. Language export
119. Auto language detection
120. Localization support

## 13. AI Studio – Brand Brain
121. Brand tone storage
122. Brand style guide
123. Brand copy consistency
124. Brand voice training
125. Brand phrase suggestions
126. Brand keyword alignment
127. Brand rewrite
128. Brand audit
129. Brand messaging suggestions
130. Brand knowledge base

## 14. AI Studio – Refactor
131. HTML refactor
132. Structure cleanup
133. Accessibility fixes
134. Semantic markup suggestions
135. Performance improvements
136. Code simplification
137. Duplicate element detection
138. Layout normalization
139. Component extraction
140. Clean export preparation

## 15. Import & Extraction
141. URL crawler
142. Sitemap extraction
143. Asset extraction
144. Image download
145. CSS extraction
146. Font detection
147. Screenshot import
148. PDF import
149. HTML import
150. WordPress parser

## 16. Export
151. Clean HTML export
152. Raw HTML export
153. WordPress theme export
154. WordPress block export
155. Shopify section export
156. React component export
157. Web component export
158. Webflow JSON export
159. Email template export
160. Markdown export

## 17. Publishing
161. Publish preview
162. Share preview links
163. Deployment targets
164. Custom domains
165. Deployment history
166. Rollback deployment
167. Static site export
168. Netlify deploy
169. CDN compatibility
170. Download package

## 18. Teams & Organizations
171. Organization creation
172. Team workspaces
173. Member invitations
174. Role management
175. Permissions
176. Project sharing
177. Shared previews
178. Activity logs
179. Collaboration workflow
180. Team settings

## 19. Settings
181. API key management
182. Model selection
183. Provider auto-detection
184. AI enable/disable toggles
185. Theme settings
186. Dark/light mode
187. Keyboard shortcuts
188. Approval workflows
189. Local AI integration
190. Organization settings

## 20. Platform Infrastructure
191. Audit logging
192. API rate limiting
193. Security validation
194. Data storage
195. Asset library merging
196. Translation pipeline
197. Export build pipeline
198. AI usage telemetry
199. Admin dashboard
200. Feature flag system

---

## B) YC 308 Checklist

Quelle: nach status/master_checklists.md migriert (urspruenglich status/checklist_items.txt aus Roadmap-Checkliste)

| ID | Requirement | Tag |
|---|---|---|
| a1 | User can register with email + password | - |
| a2 | Email validation on registration (format check + uniqueness) | - |
| a3 | Password strength requirements enforced | - |
| a4 | Email verification sent on signup | - |
| a5 | Duplicate email registration rejected with clear error | - |
| a6 | User can log in with email + password | - |
| a7 | Session persists on page reload (session restore) | - |
| a8 | User can log out from any page | - |
| a9 | Failed login shows clear error (no user / wrong password) | - |
| a10 | Session expires after inactivity (configurable timeout) | - |
| a11 | JWT or equivalent token-based auth | - |
| a12 | Refresh token flow (silent re-auth without re-login) | - |
| a13 | Forgot password flow — user enters email | - |
| a14 | Password reset email sent with secure time-limited link | - |
| a15 | Reset link expires after use or after 1 hour | - |
| a16 | User can set new password on reset page | - |
| a17 | Invalid/expired reset link shows clear error | - |
| a18 | User can change their email address | - |
| a19 | User can change their password from settings | - |
| a20 | User can upload / change profile avatar | - |
| a21 | User can update display name | - |
| a22 | User can delete their account (with confirmation) | YC |
| a23 | GDPR data export (download all user data) | YC |
| a24 | Rate limiting on login attempts (brute force protection) (Lock after N failed attempts or add captcha) | Critical |
| a25 | Two-factor authentication (TOTP / email OTP) | YC |
| a26 | OAuth login (Google at minimum) | YC |
| a27 | Passwords hashed with bcrypt or argon2 (never plain text) | Critical |
| a28 | All auth endpoints use HTTPS | Critical |
| b1 | Multiple plan tiers (Free / Pro / Agency or similar) | - |
| b2 | Features gated per plan (editor limits, AI access, exports) | - |
| b3 | User can view current plan details | - |
| b4 | User can upgrade plan | - |
| b5 | User can downgrade plan | - |
| b6 | Admin can change any user's plan | - |
| b7 | Plan comparison page / pricing page publicly visible | YC |
| b8 | Per-user credit balance tracked in real time | - |
| b9 | AI actions deduct credits with accurate cost calculation | - |
| b10 | User sees credit balance before confirming an AI action | - |
| b11 | Action blocked if insufficient credits (clear error message) | - |
| b12 | Top-up flow — user can buy more credits | - |
| b13 | Credit transaction history visible to user | - |
| b14 | Monthly credit reset or rollover logic clearly defined | - |
| b15 | Stripe (or equivalent) integration for card payments | Critical |
| b16 | Subscription billing — recurring charges work correctly | Critical |
| b17 | Payment failure handled gracefully (retry, email notification) | - |
| b18 | Invoice / receipt generated per payment | YC |
| b19 | User can cancel subscription (self-serve) | YC |
| b20 | Refund policy visible and refunds possible via admin | - |
| b21 | VAT / tax handling for EU customers | YC |
| d1 | Dark mode — full dashboard, editor, settings | - |
| d2 | Light mode — full dashboard, editor, settings | - |
| d3 | Theme preference saved per user (persists across sessions) | - |
| d4 | System theme preference respected (prefers-color-scheme) | - |
| d5 | Main nav: Projects, Templates, Exports, AI Studio workspaces | - |
| d6 | Global search across projects, pages, templates | - |
| d7 | Keyboard shortcuts for common actions | YC |
| d8 | Breadcrumb navigation inside project / page / editor | - |
| d9 | Mobile-responsive dashboard (usable on tablet) | - |
| d10 | Empty states with helpful CTAs (no blank screens) | - |
| d11 | Loading states / skeletons (no unstyled loading) | - |
| d12 | Error boundaries — app doesn't white-screen on JS errors | Critical |
| d13 | Toast / notification system for actions (success, error, info) | - |
| d14 | All interactive elements keyboard-navigable | YC |
| d15 | Focus indicators visible on all interactive elements | - |
| d16 | WCAG AA contrast ratio on all text | - |
| d17 | Semantic HTML / ARIA labels on key components | - |
| d18 | Profile settings page (name, avatar, email, password) | - |
| d19 | Billing settings page (plan, invoices, payment method) | - |
| d20 | AI model settings (grouped: Chat, Image, Video, Code, Extras) | - |
| d21 | Notification preferences page | - |
| d22 | API key management page (for power users / integrations) | YC |
| p1 | Create new project (blank) | - |
| p2 | Open existing project | - |
| p3 | Rename project | - |
| p4 | Duplicate project | - |
| p5 | Delete project (with confirmation) | - |
| p6 | Restore deleted project (soft delete + restore) | - |
| p7 | Pin / unpin project to top of dashboard | - |
| p8 | Search projects by name | - |
| p9 | Filter projects by status / assignee / tag | - |
| p10 | Sort projects (newest, name, last edited) | - |
| p11 | Stage tracking (Draft / In Review / Complete / etc.) | - |
| p12 | Due date set per project | - |
| p13 | Client name stored per project | - |
| p14 | Assignees set per project | - |
| p15 | Export history visible per project | - |
| p16 | Workflow / AI action history visible per project | - |
| p17 | Project thumbnail / preview image auto-generated | - |
| p18 | Project tags / labels for organisation | - |
| p19 | One project holds multiple pages | USP |
| p20 | Page explorer view inside project (not forced into editor) | - |
| p21 | Internal links scanned and stored as project pages | USP |
| p22 | Add new page to existing project manually | - |
| p23 | Delete a page from a project | - |
| p24 | Page-level metadata (title, slug, SEO fields) | - |
| p25 | Shared components/templates reused across pages in project | YC |
| i1 | Import homepage from live URL | USP |
| i2 | Same-origin page scan (crawl all pages on same domain) | USP |
| i3 | Sitemap-based import (parse sitemap.xml and import all pages) | USP |
| i4 | Internal links extracted and stored as page list | - |
| i5 | Assets (images, fonts, CSS, JS) downloaded and localised | Critical |
| i6 | Import handles redirect chains (301, 302) | - |
| i7 | Import behind basic auth or with cookie/header injection | YC |
| i8 | Import success rate tracked and reported (target >95%) | Critical |
| i9 | Upload single HTML file | - |
| i10 | Upload ZIP archive (full site or theme) | USP |
| i11 | Upload folder (drag-and-drop entire folder) | USP |
| i12 | Upload screenshot / image (AI reconstructs layout) | USP |
| i13 | Upload brief / text doc (AI generates structure from brief) | USP |
| i14 | Upload asset pack (images, fonts, brand kit) | - |
| i15 | Upload Figma export (PNG/SVG frames → layout reconstruction) | YC |
| i16 | Distinguishes page templates from assets, support files, style files | USP |
| i17 | WordPress-aware: front-page.php, functions.php treated semantically | USP |
| i18 | Locale / language files detected and separated | - |
| i19 | Repeated section / component detection across pages | Critical |
| i20 | Nav structure reconstructed (primary nav, footer nav) | Critical |
| i21 | Forms and CTAs preserved through import | Critical |
| i22 | Gemini used to refine structural interpretation of messy uploads | USP |
| i23 | Import fidelity score generated per project (before/after diff) | YC |
| i24 | Import preview before committing (user sees result before saving) | YC |
| i25 | SEO metadata (title, description, og tags) preserved on import | Critical |
| e1 | Live iframe preview renders actual page HTML | - |
| e2 | Block overlay system identifies editable sections | - |
| e3 | Click to select a block | - |
| e4 | Inline text editing (double-click to edit text in place) | - |
| e5 | Block movement (drag to reorder or move up/down) | - |
| e6 | Block split (split one block into two) | - |
| e7 | Block delete | - |
| e8 | Insert new component / block between existing blocks | - |
| e9 | Block family filter (filter visible blocks by type) | - |
| e10 | Structure snapshot sent from iframe to app UI | - |
| e11 | Save / auto-save edited state | Critical |
| e12 | Undo / redo (Ctrl+Z) within editor session | Critical |
| e13 | Replace image in block (upload or URL) | - |
| e14 | Image resize / crop within editor | - |
| e15 | AI image generation inline in editor | YC |
| e16 | Asset library per project (all uploaded images/fonts accessible) | - |
| e17 | Color picker for text / background / border | - |
| e18 | Typography controls (font, size, weight, line height) | - |
| e19 | Spacing controls (padding, margin per block) | - |
| e20 | Global style overrides (site-wide font / color changes) | YC |
| e21 | CSS custom properties / variables panel | YC |
| e22 | Raw HTML / code view per block (for developers) | - |
| e23 | Desktop / tablet / mobile preview toggle in editor | - |
| e24 | Full-page preview (no UI chrome, just the page) | - |
| e25 | Share preview link (public URL showing current state) | YC |
| ai1 | AI rewrite selected block (text content) | - |
| ai2 | AI rewrite with custom prompt / instruction | - |
| ai3 | Streaming rewrite (text appears as it generates) | - |
| ai4 | AI tone options (professional, casual, persuasive, etc.) | - |
| ai5 | Accept or reject AI suggestion (diff view preferred) | Critical |
| ai6 | AI suggest layout improvement for block | - |
| ai7 | Full page AI rescan (re-analyse all blocks) | - |
| ai8 | AI SEO audit of full page (title, meta, headings, alt text) | YC |
| ai9 | AI CRO audit (suggest CTA, headline, layout improvements) | YC |
| ai10 | AI accessibility audit (missing alt text, contrast, labels) | - |
| ai11 | Batch AI action across multiple pages | USP |
| ai12 | AI actions require approval before execution (configurable) | - |
| ai13 | Approval flow: action queued, user approves, then continues | - |
| ai14 | Credit cost shown before any AI action | Critical |
| ai15 | Server-side model routing (choose best model per task type) | - |
| ai16 | AI context-aware: knows current workspace / project / block | - |
| ai17 | Bottom-right context-aware AI copilot widget | - |
| ai18 | Assistant knows current workspace / project / block / export context | - |
| ai19 | Plan-based model access (higher plan = better model) | - |
| ai20 | Chat history per session | - |
| ai21 | Assistant can take actions (trigger exports, translations, rewrites) | YC |
| t1 | Translate full page into any of 50+ languages | USP |
| t2 | Only text nodes and translatable attributes rewritten (DOM preserved) | USP |
| t3 | Block overlays still work after translation | - |
| t4 | Translated page exportable in all 10 formats | USP |
| t5 | Translation quality review UI (highlight translated segments) | - |
| t6 | Manual override of any translated segment | - |
| t7 | Store language variants per page (not just overwrite current state) | Critical |
| t8 | Side-by-side editor: original language vs translated | YC |
| t9 | Switch between language variants in editor without re-translating | - |
| t10 | Export all language variants as separate output bundle | YC |
| t11 | Hreflang tags auto-generated in exported HTML | YC |
| ex1 | HTML Clean — readable, production-ready HTML/CSS | USP |
| ex2 | HTML Raw — unmodified source HTML | - |
| ex3 | WordPress Theme — full installable .zip theme | USP |
| ex4 | WordPress Block — Gutenberg-compatible block(s) | USP |
| ex5 | WordPress Placeholder — lightweight template placeholder | - |
| ex6 | Shopify Section — valid Liquid section file | USP |
| ex7 | Web Component — standalone custom element | USP |
| ex8 | Email Newsletter — inline-CSS, table-based email HTML | USP |
| ex9 | Markdown — clean .md file (content extracted) | - |
| ex10 | PDF Print — print-ready PDF from page layout | - |
| ex11 | React component export (JSX) | YC |
| ex12 | Webflow JSON import format | YC |
| ex13 | SEO metadata (title, meta description, og tags) in every export | Critical |
| ex14 | All assets (images, fonts) correctly linked in output | Critical |
| ex15 | Internal links preserved and correct in output | Critical |
| ex16 | Forms functional in target environment after export | Critical |
| ex17 | HTML valid (passes W3C validator) | - |
| ex18 | CSS clean (no orphaned rules, no inline bloat) | - |
| ex19 | Export validated before delivery (readiness state + warnings) | - |
| ex20 | Manifest + delivery notes in every export ZIP | - |
| ex21 | Export pass rate tracked (target >98% valid exports) | YC |
| ex22 | Target-native editability: WordPress export editable in WP, Shopify in Shopify | Critical |
| pub1 | Deploy to Firebase Hosting (one-click from dashboard) | Critical |
| pub2 | Deploy to Netlify (one-click or drag-drop integration) | Critical |
| pub3 | Deploy to Vercel | YC |
| pub4 | Push to WordPress install via WP-CLI / REST API | YC |
| pub5 | Push to Shopify store via Shopify API | YC |
| pub6 | Custom domain mapping for hosted projects | YC |
| pub7 | Preview URL generated before final publish | - |
| pub8 | Publish history (list of all deployments per project) | - |
| pub9 | Rollback to previous deployment | YC |
| s1 | Autonomous CRO Agent — analyses page, suggests + applies CRO improvements | USP |
| s2 | Self-Healing Website — detects broken elements, auto-fixes | USP |
| s3 | One-Click Global Expansion — translate + adapt for new market | USP |
| s4 | Brand Brain — extract and store brand voice/style from existing site | - |
| s5 | Competitor War Room — competitive analysis with AI research | - |
| s6 | Personalized Site per Visitor — rules/segments for dynamic content | USP |
| s7 | Company-in-a-Box — full website + brand from company description | - |
| s8 | Figma / Screenshot → Product — image to editable page | - |
| s9 | Full Funnel Generator — landing page + thank you + email sequence | - |
| s10 | AI Sales Closer — optimise page for conversion with A/B suggestions | - |
| s11 | Save run history per AI Studio tool | Critical |
| s12 | View outputs from previous runs | Critical |
| s13 | Re-run / refresh a previous run | - |
| s14 | Compare runs side by side | YC |
| s15 | Plan gating per tool (which plans access which tools) | - |
| s16 | Each tool is either fully autonomous or clearly labelled as "guided" | Critical |
| v1 | Auto-save version snapshot on every significant edit | Critical |
| v2 | Named manual snapshots ("Before AI rewrite", "Client approved v2") | Critical |
| v3 | Version history list per page (timestamp + action label) | Critical |
| v4 | Preview any historical version | Critical |
| v5 | Restore (rollback) to any previous version | Critical |
| v6 | Diff view: compare current state vs previous version (visual) | YC |
| v7 | Version history per project (not just per page) | - |
| v8 | Auto-snapshot before every AI action (safe default) | Critical |
| tm1 | Create organisation | - |
| tm2 | Invite member to org by email | - |
| tm3 | Remove member from org | - |
| tm4 | Roles: Owner, Admin, Editor, Viewer | YC |
| tm5 | Permissions enforced per role (viewer can't edit, etc.) | YC |
| tm6 | Project assignees (assign project to specific team members) | - |
| tm7 | Comments / annotation on blocks (for review workflow) | YC |
| tm8 | Client share link (client can view/comment without account) | YC |
| tm9 | Approval / sign-off workflow (client approves before export) | YC |
| ad1 | View all users with search and filter | - |
| ad2 | Change any user's plan from admin | - |
| ad3 | Adjust any user's credit balance from admin | - |
| ad4 | Send password reset email from admin | - |
| ad5 | Suspend / ban user account | - |
| ad6 | Impersonate user (for debugging with permission) | - |
| ad7 | Audit log — every admin action recorded with timestamp + actor | YC |
| ad8 | Dashboard: new signups per day/week/month | YC |
| ad9 | Dashboard: MRR and revenue over time | YC |
| ad10 | Dashboard: AI credit usage per model per day | - |
| ad11 | Dashboard: import success/fail rate | YC |
| ad12 | Dashboard: export success/fail rate per format | YC |
| ad13 | Dashboard: churn rate and retention cohorts | YC |
| r1 | Unit tests for import pipeline (each source type) | Critical |
| r2 | Unit tests for export pipeline (each format) | Critical |
| r3 | Integration tests: import → edit → export full flow | Critical |
| r4 | E2E tests for auth flow (register, login, reset password) | - |
| r5 | E2E tests for billing flow (subscribe, upgrade, cancel) | - |
| r6 | CI/CD pipeline — tests run on every push | - |
| r7 | Regression test suite for AI rewrites (before/after fidelity) | - |
| r8 | Error tracking (Sentry or equivalent) with alerts | Critical |
| r9 | Uptime monitoring with alerting | Critical |
| r10 | API rate limiting on all public endpoints | - |
| r11 | Database backups (daily automated) | Critical |
| r12 | Performance: dashboard loads in <2s on cold start | - |
| r13 | Performance: editor loads in <3s with imported content | - |
| r14 | Status page (public uptime history — builds trust) | YC |
| tr1 | 10+ paying customers (real money, not free tier) | PMF |
| tr2 | $2,000+ MRR from beachhead (agency migration use case) | PMF |
| tr3 | Week-over-week revenue growth for 4+ consecutive weeks | PMF |
| tr4 | At least 1 agency paying >$200/month | PMF |
| tr5 | Net Revenue Retention >100% (users upgrade, not churn) | PMF |
| tr6 | PMF survey sent: "How disappointed if you could no longer use edit?" — target >40% "Very disappointed" | PMF |
| tr7 | 20+ user interviews completed (documented pain + outcome) | PMF |
| tr8 | 1 case study published: real agency, real site, real time saved | PMF |
| tr9 | Quantified value prop: "X hours saved per site migration" (real data) | PMF |
| tr10 | NPS score tracked (target >50) | PMF |
| tr11 | Import success rate published (e.g. "94% of imports succeed") | YC |
| tr12 | Export pass rate published (e.g. "98% valid exports") | YC |
| tr13 | Average time saved per migration (benchmark vs manual rebuild) | YC |
| tr14 | Number of source types supported (published on landing page) | - |
| tr15 | Press / community mention in agency/webdev/indie hacker circles | YC |
| pos1 | One-sentence value prop on homepage (crystal clear, not generic) | Critical |
| pos2 | Primary beachhead clearly stated: "for agencies rebuilding client sites" | Critical |
| pos3 | Pricing page live and public | - |
| pos4 | Feature comparison vs top 3 competitors (on website) | YC |
| pos5 | Use-case landing pages (e.g. /agency-migration, /wordpress-to-shopify) | YC |
| pos6 | ProductHunt launch prepared | YC |
| pos7 | Indie Hackers / Hacker News Show HN post drafted | YC |
| pos8 | Active in 2–3 agency/webdev/indie hacker circles | YC |
| pos9 | Docs / help center live (search-friendly) | - |
| pos10 | Demo video (2 min: import a real site → edit → export) on homepage | Critical |
| yc1 | One-line company description written (50 words max, crystal clear) | YC |
| yc2 | Problem description written (what is the exact painful problem) | YC |
| yc3 | Solution description written (how you uniquely solve it) | YC |
| yc4 | Why now — why is this the right time for this product | YC |
| yc5 | Market size — TAM / SAM / SOM estimated with sources | YC |
| yc6 | Traction section: MRR, user count, growth rate, key metrics | YC |
| yc7 | Business model: how you charge, unit economics per customer | YC |
| yc8 | Competition section: who competes + why you win | YC |
| yc9 | Moat / defensibility: what makes this hard to copy | YC |
| yc10 | Team section: who you are, why you can build this | YC |
| yc11 | Video demo recorded: 2 min, shows real import → edit → export | YC |
| yc12 | Incorporated entity (Delaware C-Corp preferred for YC) | YC |
| yc13 | Equity / cap table clean (no messy pre-seed mess) | YC |
| yc14 | Applied to YC batch (or on waitlist for next batch) | YC |
