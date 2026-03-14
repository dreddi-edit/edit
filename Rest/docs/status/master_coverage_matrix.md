# Reframe Coverage Matrix (200 vs 308)

Stand: 2026-03-14

Statuswerte: full | partial | missing | todo | n/a

## Summary

- Feature inventory total: 200
- YC checklist total: 308
- Mapping gepflegt in den Tabellen unten

## 200 Features Tracking

| Feature # | Feature | Status | Evidence (file/function) | Linked YC IDs | Last Update |
|---:|---|---|---|---|---|
| 1 | User registration | full | dashboard/src/api/auth.ts apiRegister; server/auth.js registerAuthRoutes /api/auth/register | - | 2026-03-14 |
| 2 | Email login | full | dashboard/src/api/auth.ts apiLogin; server/auth.js registerAuthRoutes /api/auth/login | - | 2026-03-14 |
| 3 | Password reset | full | dashboard/src/api/auth.ts apiResetPassword; server/auth.js registerAuthRoutes /api/auth/reset-password | - | 2026-03-14 |
| 4 | Forgot password flow | full | dashboard/src/components/AuthScreen.tsx forgot mode/handler; server/auth.js registerAuthRoutes /api/auth/forgot-password | - | 2026-03-14 |
| 5 | Session restore | full | dashboard/src/api/client.ts tryRefreshSession/fetchWithAuth; server/auth.js registerAuthRoutes /api/auth/refresh | - | 2026-03-14 |
| 6 | Logout | full | dashboard/src/api/auth.ts apiLogout; server/auth.js registerAuthRoutes /api/auth/logout | - | 2026-03-14 |
| 7 | Account settings | full | dashboard/src/components/SettingsPanel.tsx settings tabs/save flows; server/settings.js registerSettingsRoutes | - | 2026-03-14 |
| 8 | Profile management | full | dashboard/src/api/auth.ts apiMe; server/auth.js /api/auth/me PUT /api/auth/avatar | - | 2026-03-14 |
| 9 | Email verification | full | dashboard/src/components/AuthScreen.tsx email_verified flow; server/auth.js /api/auth/verify-email and /verify | - | 2026-03-14 |
| 10 | Security logs | full | dashboard/src/components/ActivityAuditLog.tsx ip_address+user_agent display; server/auditLog.js logAudit ip/ua capture | - | 2026-03-14 |
| 11 | Plan tiers | full | dashboard/src/components/CreditsPanel.tsx subscriptionPlans; server/stripe.js defaultPackages subscription_plans | - | 2026-03-14 |
| 12 | Credit balance | full | dashboard/src/components/CreditsPanel.tsx balance UI; server/credits.js /api/credits/balance | - | 2026-03-14 |
| 13 | Credit deduction for AI usage | full | server/credits.js deductCredits/hasEnoughCredits; server/index.js deductCredits on AI rewrite | - | 2026-03-14 |
| 14 | Transaction history | full | dashboard/src/components/CreditsPanel.tsx transactions; server/credits.js /api/credits/transactions | - | 2026-03-14 |
| 15 | Top-up credits | full | dashboard/src/components/CreditsPanel.tsx checkout/subscribe; server/credits.js /api/credits/topup and server/stripe.js checkout | - | 2026-03-14 |
| 16 | Admin plan changes | full | dashboard/src/hooks/useAdmin.ts assignPlan; server/index.js /api/admin/users/:id/set-plan | - | 2026-03-14 |
| 17 | Usage tracking | full | server/index.js GET /api/usage/stats (by_tool/by_day/credits); dashboard/src/App.tsx trackUsage/sessionCost | - | 2026-03-14 |
| 18 | Cost estimation | full | dashboard/src/assistantLogic.ts calculateCost; server/credits.js estimateCreditCost | - | 2026-03-14 |
| 19 | AI cost attribution per project | full | server/index.js GET /api/credits/by-project per-project EUR aggregation; server/assistant.js ai_studio_runs project_id | - | 2026-03-14 |
| 20 | Billing overview | full | dashboard/src/components/CreditsPanel.tsx plans/credits/transactions; dashboard/src/components/SettingsPanel.tsx invoiceRows | - | 2026-03-14 |
| 21 | Project dashboard | full | dashboard/src/components/ProjectDashboard.tsx ProjectDashboard/loadDashboard; server/projects.js /api/projects | - | 2026-03-14 |
| 22 | Template dashboard | full | dashboard/src/components/ProjectDashboard.tsx activeWorkspace templates; server/templates.js /api/templates | - | 2026-03-14 |
| 23 | Export dashboard | full | dashboard/src/components/ProjectDashboard.tsx activeWorkspace exports; server/projects.js project_exports | - | 2026-03-14 |
| 24 | AI Studio dashboard | full | dashboard/src/components/ProjectDashboard.tsx activeWorkspace ai-studio/runStudioAgent; server/assistant.js /api/assistant/run | - | 2026-03-14 |
| 25 | Search projects | full | dashboard/src/components/ProjectDashboard.tsx search/project filters; server/projects.js GET /api/projects q | - | 2026-03-14 |
| 26 | Pin projects | full | dashboard/src/components/ProjectDashboard.tsx pinned sorting/actions; server/projects.js /api/projects/:id/pin | - | 2026-03-14 |
| 27 | Delete projects | full | dashboard/src/components/ProjectDashboard.tsx deleteProject; server/projects.js app.delete("/api/projects/:id") | - | 2026-03-14 |
| 28 | Restore projects | full | server/projects.js deleted project restore routes; dashboard/src/components/ProjectDashboard.tsx deleted project flows | - | 2026-03-14 |
| 29 | Duplicate projects | full | server/projects.js /api/projects/:id/duplicate; dashboard/src/components/ProjectDashboard.tsx project actions | - | 2026-03-14 |
| 30 | Project sorting | full | dashboard/src/components/ProjectDashboard.tsx projectSort; server/projects.js GET /api/projects sort | - | 2026-03-14 |
| 31 | Create project | full | dashboard/src/components/ProjectDashboard.tsx createProject; dashboard/src/api/projects.ts apiCreateProject | - | 2026-03-14 |
| 32 | Import project from URL | full | dashboard/src/components/ProjectDashboard.tsx import preview flow; server/projectImport.js buildProjectImportPreview/importFromUrl | - | 2026-03-14 |
| 33 | Import project ZIP | full | dashboard/src/api/projects.ts apiPreviewProjectImport kind zip; server/projectImport.js readZipEntries | - | 2026-03-14 |
| 34 | Multi-page projects | full | dashboard/src/api/projects.ts apiCreateProjectPage/apiDeleteProjectPage; server/projects.js page routes/pages_json | - | 2026-03-14 |
| 35 | Page list view | full | dashboard/src/components/ProjectDashboard.tsx page tree/list; server/projects.js pages_json routes | - | 2026-03-14 |
| 36 | Internal link scanner | full | dashboard/src/api/projects.ts apiScanProjectPages; server/projects.js /api/projects/:id/pages/scan | - | 2026-03-14 |
| 37 | Project metadata | full | dashboard/src/api/projects.ts project seo/workflow metadata; server/projects.js mapProjectRow/update | - | 2026-03-14 |
| 38 | Client names | full | dashboard/src/components/ProjectDashboard.tsx client name fields; server/db.js projects_client_name migration | - | 2026-03-14 |
| 39 | Due dates | full | dashboard/src/components/ProjectDashboard.tsx due date fields; server/db.js projects_due_at migration | - | 2026-03-14 |
| 40 | Assignees | full | dashboard/src/components/ProjectDashboard.tsx newAssigneeEmails/toggleAssignee; server/projects.js listAssignableMembers and assignee routes | - | 2026-03-14 |
| 41 | Visual editor iframe | full | dashboard/src/App.tsx renderToIframe/iframeRef; dashboard/src/components/BlockOverlay.tsx iframeRef integration | - | 2026-03-14 |
| 42 | Block selection | full | dashboard/src/components/BlockOverlay.tsx active block selection; dashboard/src/App.tsx selectedBlockId | - | 2026-03-14 |
| 43 | Block highlighting | full | dashboard/src/components/BlockOverlay.tsx highlight overlay boxes | - | 2026-03-14 |
| 44 | Drag-and-drop blocks | full | dashboard/src/components/BlocksSidebar.tsx draggable items; dashboard/src/components/BlockOverlay.tsx drop reorder/insert | - | 2026-03-14 |
| 45 | Component library | full | dashboard/src/components/EditorSidebar.tsx componentEntries; dashboard/src/components/ComponentLibrary.tsx templates | - | 2026-03-14 |
| 46 | Edit inline text | full | dashboard/src/components/BlockOverlay.tsx contenteditable inline edit/onHtmlChange | - | 2026-03-14 |
| 47 | Edit attributes | full | dashboard/src/components/BlockOverlay.tsx setAttribute/editLink/editImgAlt; dashboard/src/components/DomLogicControl.tsx | - | 2026-03-14 |
| 48 | DOM tree parsing | full | dashboard/src/components/VisualNodeTree.tsx DOMParser/getTree; dashboard/src/editorHelpers.ts DOMParser usage | - | 2026-03-14 |
| 49 | Structure panel | full | dashboard/src/components/EditorStructure.tsx structureItems/moveStructureItem; dashboard/src/App.tsx structureItems | - | 2026-03-14 |
| 50 | Live preview | full | dashboard/src/App.tsx renderToIframe effect on currentHtml; dashboard/src/components/BlockOverlay.tsx onHtmlChange live edits | - | 2026-03-14 |
| 51 | Layout inspector | full | dashboard/src/components/ZIndexInspector.tsx layer audit UI with flex/grid detection; dashboard/src/components/EditorView.tsx inspector mount | - | 2026-03-14 |
| 52 | Style overrides | full | dashboard/src/editorHelpers.ts applyGlobalStylesToHtml; dashboard/src/App.tsx globalStyleOverrides | - | 2026-03-14 |
| 53 | CSS variable extraction | full | dashboard/src/editorHelpers.ts collectCssVariables; dashboard/src/components/CssVariableExtractor.tsx; server/index.js /api/ai/html-refactor type=css_cleanup | - | 2026-03-14 |
| 54 | Font detection | full | dashboard/src/components/FontManager.tsx typography UI; server/assistant.js brand_brain font_families extraction from CSS/HTML | - | 2026-03-14 |
| 55 | Asset management | full | dashboard/src/App.tsx mergeAssetLibraries/assetLibrary save; server/projects.js asset_library_json persistence | - | 2026-03-14 |
| 56 | Image replacement | full | dashboard/src/components/BlockOverlay.tsx image src/alt editing; dashboard/src/App.tsx readFileAsDataUrl | - | 2026-03-14 |
| 57 | Responsive preview | full | dashboard/src/editorHelpers.ts VIEWPORT_PRESETS; dashboard/src/App.tsx editor viewport switcher | - | 2026-03-14 |
| 58 | Desktop viewport | full | dashboard/src/editorHelpers.ts VIEWPORT_PRESETS.desktop; dashboard/src/App.tsx editor-viewport-switcher | - | 2026-03-14 |
| 59 | Tablet viewport | full | dashboard/src/editorHelpers.ts VIEWPORT_PRESETS.tablet; dashboard/src/App.tsx editor-viewport-switcher | - | 2026-03-14 |
| 60 | Mobile viewport | full | dashboard/src/editorHelpers.ts VIEWPORT_PRESETS.mobile; dashboard/src/App.tsx editor-viewport-switcher | - | 2026-03-14 |
| 61 | Snapshot creation | full | dashboard/src/App.tsx createVersionSnapshot/handleManualSnapshot; dashboard/src/api/projects.ts apiCreateProjectVersion | - | 2026-03-14 |
| 62 | Version history | full | dashboard/src/App.tsx loadProjectVersions; server/projects.js /api/projects/:id/versions | - | 2026-03-14 |
| 63 | Version restore | full | dashboard/src/App.tsx restoreProjectVersion; server/projects.js /api/projects/:id/restore/:versionId | - | 2026-03-14 |
| 64 | Version comparison | full | dashboard/src/App.tsx compareProjectVersion/versionCompare; dashboard/src/App.tsx comparisonIframeRef split compare viewport | - | 2026-03-14 |
| 65 | Diff preview | full | dashboard/src/editorHelpers.ts buildDiffPreview; dashboard/src/components/EditorModals.tsx AI before/after diff | - | 2026-03-14 |
| 66 | Change tracking | full | server/projects.js activity/version/export/share tracking; dashboard/src/App.tsx undoHistory; server/auditLog.js logAudit | - | 2026-03-14 |
| 67 | Workflow history | full | dashboard/src/App.tsx loadWorkflowHistory; server/projects.js /api/projects/:id/workflow-history | - | 2026-03-14 |
| 68 | Publish history | full | dashboard/src/App.tsx loadPublishHistory; server/publish.js /api/projects/:id/publish/history | - | 2026-03-14 |
| 69 | Rollback deployment | full | dashboard/src/App.tsx rollbackPublishedDeployment; server/publish.js rollback route | - | 2026-03-14 |
| 70 | Audit log | full | server/auditLog.js logAudit; server/index.js /api/admin/audit | - | 2026-03-14 |
| 71 | AI Studio workspace | full | dashboard/src/components/ProjectDashboard.tsx activeWorkspace ai-studio; server/assistant.js ai_studio_runs | - | 2026-03-14 |
| 72 | Multi-model execution | full | dashboard/src/utils/modelCatalog.ts provider catalog; server/index.js Claude/Gemini/Groq/Ollama execution | - | 2026-03-14 |
| 73 | Agent chaining | full | server/assistant.js agent_chain tool runs up to 5 tools in sequence with context pass-through | - | 2026-03-14 |
| 74 | Prompt templating | full | dashboard/src/components/AIPresetManager.tsx server-backed CRUD; server/presets.js GET/POST/PUT/DELETE /api/presets with default seeding | - | 2026-03-14 |
| 75 | Streaming responses | full | server/index.js SSE stream endpoint; dashboard/src/components/BlockOverlay.tsx streaming client | - | 2026-03-14 |
| 76 | Credit cost estimation | full | dashboard/src/assistantLogic.ts calculateCost; server/index.js estCost/needsApproval response | - | 2026-03-14 |
| 77 | AI run history | full | dashboard/src/components/ProjectDashboard.tsx studio run history; server/assistant.js ai_studio_runs list/get | - | 2026-03-14 |
| 78 | Agent audit logs | full | server/assistant.js ai_studio_runs status created/running/done/error; server/auditLog.js logAudit on run lifecycle | - | 2026-03-14 |
| 79 | AI suggestions | full | dashboard/src/components/AiSuggestionChip.tsx API-driven via /api/ai/inline-suggestions; 5 action types (simplify/professional/headlines/cro/cta) | - | 2026-03-14 |
| 80 | Auto-apply changes | full | dashboard/src/components/BlockOverlay.tsx applies AI HTML result; server/index.js rewrite endpoints return html | - | 2026-03-14 |
| 81 | Rewrite copy | full | dashboard/src/components/BlockOverlay.tsx AI rewrite prompt flow; server/index.js /api/rewrite-block | - | 2026-03-14 |
| 82 | Improve readability | full | server/index.js rewrite-block mode=readability injects readability system hint; dashboard/src/components/BlockOverlay.tsx mode param | - | 2026-03-14 |
| 83 | Tone adjustment | full | server/index.js rewrite-block mode=tone injects tone system hint; dashboard/src/components/StyleMirrorUI.tsx brand voice UI | - | 2026-03-14 |
| 84 | Conversion copy suggestions | full | server/assistant.js cro_agent+cro_checklist+optimization_summary tools; dashboard/src/components/ProjectDashboard.tsx CRO studio tool | - | 2026-03-14 |
| 85 | Headline generator | full | server/assistant.js headline_generator tool with tone/count params; dashboard/src/components/ProjectDashboard.tsx studio tool | - | 2026-03-14 |
| 86 | CTA improvement | full | server/index.js rewrite-block mode=cta CTA-focused system hint; server/assistant.js cro_agent CTA suggestions | - | 2026-03-14 |
| 87 | Product description rewrite | full | server/index.js rewrite-block mode=product product-optimized system hint; dashboard/src/components/BlockOverlay.tsx mode param | - | 2026-03-14 |
| 88 | Blog rewrite | full | server/index.js rewrite-block mode=blog blog-focused system hint; dashboard/src/components/BlockOverlay.tsx mode param | - | 2026-03-14 |
| 89 | Email copy generation | full | server/assistant.js email_copy_generator tool with subject/body/CTA per step; server/index.js rewrite-block mode=email | - | 2026-03-14 |
| 90 | Ad copy suggestions | full | server/assistant.js ad_copy_generator tool for Google/Facebook/LinkedIn/Twitter; dashboard/src/components/ProjectDashboard.tsx studio tool | - | 2026-03-14 |
| 91 | CRO audit | full | dashboard/src/editorHelpers.ts CRO audit; dashboard/src/components/EditorAudits.tsx CRO button | - | 2026-03-14 |
| 92 | Conversion suggestions | full | server/index.js POST /api/ai/inline-suggestions action=cro; server/assistant.js cro_agent suggestions | - | 2026-03-14 |
| 93 | UX friction detection | full | server/index.js /api/ai/inline-suggestions action=ux_friction; dashboard/src/components/AiSuggestionChip.tsx + EditorAudits.tsx | - | 2026-03-14 |
| 94 | Funnel analysis | full | dashboard/src/components/ProjectDashboard.tsx runStudioAgent funnel_generator; server/assistant.js funnel_generator | - | 2026-03-14 |
| 95 | CTA placement advice | full | server/index.js /api/ai/inline-suggestions action=cta; server/assistant.js cro_agent CTA placement suggestions | - | 2026-03-14 |
| 96 | Hero section optimization | full | server/index.js rewrite-block mode=hero hero-optimized system hint; server/assistant.js cro_agent rewritten_html | - | 2026-03-14 |
| 97 | Landing page scoring | full | server/assistant.js landing_page_score tool with 7-dimension scoring and grade; dashboard/src/components/ProjectDashboard.tsx studio tool | - | 2026-03-14 |
| 98 | A/B experiment ideas | full | server/assistant.js ab_test_ideas tool with hypotheses/metrics; dashboard/src/components/AbTestManager.tsx variants UI | - | 2026-03-14 |
| 99 | CRO checklist | full | server/assistant.js cro_checklist tool with pass/fail criteria and 0-100 score; dashboard/src/components/EditorAudits.tsx | - | 2026-03-14 |
| 100 | Optimization summary | full | server/assistant.js optimization_summary tool composite SEO+CRO+perf+a11y score; dashboard/src/components/ProjectDashboard.tsx result panels | - | 2026-03-14 |
| 101 | SEO audit | full | server/seo.js /api/seo/audit; dashboard/src/components/EditorAudits.tsx SEO button | - | 2026-03-14 |
| 102 | Meta title generation | full | server/seo.js POST /api/seo/generate-meta AI meta title with OG tags; saves to projects.seo_meta_title | - | 2026-03-14 |
| 103 | Meta description generation | full | server/seo.js POST /api/seo/generate-meta AI meta description; saves to projects.seo_meta_description | - | 2026-03-14 |
| 104 | Keyword suggestions | full | server/seo.js POST /api/seo/keyword-suggestions + server/assistant.js keyword_suggestions tool; clusters+difficulty scoring | - | 2026-03-14 |
| 105 | Content gap analysis | full | server/seo.js POST /api/seo/content-gap + server/assistant.js content_gap_analysis tool; missing topics + recommended sections | - | 2026-03-14 |
| 106 | Structured data suggestions | full | server/seo.js POST /api/seo/schema-suggestions AI JSON-LD type suggestions; dashboard/src/components/SchemaGenerator.tsx | - | 2026-03-14 |
| 107 | Internal linking suggestions | full | dashboard/src/api/projects.ts apiScanProjectPages; server/seo.js /api/seo/content-gap related pages suggestions | - | 2026-03-14 |
| 108 | SEO score | full | server/seo.js scores.seo; dashboard/src/components/ProjectDashboard.tsx studioResult audit score | - | 2026-03-14 |
| 109 | Page optimization suggestions | full | server/seo.js POST /api/seo/page-optimization AI suggestions with effort/impact scores; existing opportunities endpoint | - | 2026-03-14 |
| 110 | Search snippet preview | full | server/seo.js GET /api/seo/snippet-preview length validation + Google-style data; dashboard/src/components/SearchSnippetPreview.tsx live preview | - | 2026-03-14 |
| 111 | Multi-language translation | full | dashboard/src/App.tsx handleTranslateSite; dashboard/src/utils/htmlTranslation.ts translateWebsiteHtml | - | 2026-03-14 |
| 112 | Segment extraction | full | dashboard/src/utils/htmlTranslation.ts translation segments; dashboard/src/App.tsx translationReview state | - | 2026-03-14 |
| 113 | Translation overrides | full | dashboard/src/editorHelpers.ts applyTranslationOverridesToHtml; dashboard/src/App.tsx applyTranslationOverride | - | 2026-03-14 |
| 114 | Language switching | full | dashboard/src/App.tsx switchLanguageVariant; dashboard/src/i18n/useTranslation.ts setLang | - | 2026-03-14 |
| 115 | Language variant preview | full | dashboard/src/App.tsx switchLanguageVariant; dashboard/src/editorHelpers.ts getLanguageVariantEffectiveHtml | - | 2026-03-14 |
| 116 | Translation memory | full | server/translationMemory.js full CRUD + bulk upsert + lookup by SHA256 hash; server/db.js translation_memory table | - | 2026-03-14 |
| 117 | Batch translation | full | dashboard/src/components/TranslationManager.tsx real API call to /api/ai/rewrite-block with translation instruction + memory save; 9 target languages | - | 2026-03-14 |
| 118 | Language export | full | server/index.js buildLocalizedArtifacts; server/deliveryArtifacts.js alternates/language artifacts | - | 2026-03-14 |
| 119 | Auto language detection | full | dashboard/src/utils/htmlTranslation.ts detectedSourceLanguage; dashboard/src/App.tsx translationInfo | - | 2026-03-14 |
| 120 | Localization support | full | dashboard/src/utils/htmlTranslation.ts segments/lang attributes; server/deliveryArtifacts.js alternate links | - | 2026-03-14 |
| 121 | Brand tone storage | full | server/assistant.js brand_brain saves brand_context; server/db.js projects brand_context | - | 2026-03-14 |
| 122 | Brand style guide | full | server/assistant.js brand_style_guide tool colors/typography/spacing/do-don't; dashboard/src/components/StyleGuideGenerator.tsx | - | 2026-03-14 |
| 123 | Brand copy consistency | full | server/assistant.js brand_audit_full consistency score; dashboard/src/components/StyleMirrorUI.tsx consistency UI | - | 2026-03-14 |
| 124 | Brand voice training | full | dashboard/src/components/StyleMirrorUI.tsx brand voice UI; server/assistant.js brandContext prompt injection + brand_style_guide voice section | - | 2026-03-14 |
| 125 | Brand phrase suggestions | full | server/assistant.js brand_brain reusable messaging + brand_keyword_alignment gaps; dashboard/src/components/ProjectDashboard.tsx Brand Brain tool | - | 2026-03-14 |
| 126 | Brand keyword alignment | full | server/assistant.js brand_keyword_alignment tool alignment score + gap recommendations; dashboard/src/components/ProjectDashboard.tsx studio tool | - | 2026-03-14 |
| 127 | Brand rewrite | full | server/assistant.js brandContext prompt injection; dashboard/src/components/BlockOverlay.tsx AI rewrite | - | 2026-03-14 |
| 128 | Brand audit | full | server/assistant.js brand_audit_full tool brand score/consistency/messaging clarity/issues; dashboard/src/components/ProjectDashboard.tsx | - | 2026-03-14 |
| 129 | Brand messaging suggestions | full | server/assistant.js brand_audit_full messaging_clarity + brand_brain messaging output; dashboard/src/components/ProjectDashboard.tsx | - | 2026-03-14 |
| 130 | Brand knowledge base | full | server/assistant.js brand_brain saves brand_context; server/projects.js mapProjectRow brandContext | - | 2026-03-14 |
| 131 | HTML refactor | full | server/index.js POST /api/ai/html-refactor 8 refactor types with approval gate; dashboard/src/components/AutoLayoutRefactor.tsx type selector + real API | - | 2026-03-14 |
| 132 | Structure cleanup | full | server/index.js /api/ai/html-refactor type=simplification+duplicate_removal; server/deliveryArtifacts.js cleanupStyleBlocks | - | 2026-03-14 |
| 133 | Accessibility fixes | full | server/index.js /api/ai/html-refactor type=accessibility ARIA/alt/heading AI fix; dashboard/src/components/AltTextGenerator.tsx | - | 2026-03-14 |
| 134 | Semantic markup suggestions | full | server/index.js /api/ai/html-refactor type=semantics HTML5 semantic AI refactor; server/projectImport.js extraction | - | 2026-03-14 |
| 135 | Performance improvements | full | server/index.js /api/ai/html-refactor type=performance lazy-load/defer AI suggestions; server/seo.js performance metrics | - | 2026-03-14 |
| 136 | Code simplification | full | server/index.js /api/ai/html-refactor type=simplification AI HTML simplification; server/deliveryArtifacts.js cleanupStyleBlocks | - | 2026-03-14 |
| 137 | Duplicate element detection | full | server/index.js /api/ai/html-refactor type=duplicate_removal AI deduplication; server/projectImport.js repeatedSections | - | 2026-03-14 |
| 138 | Layout normalization | full | server/index.js /api/ai/html-refactor type=layout Flex/Grid AI normalization; dashboard/src/components/AutoLayoutRefactor.tsx | - | 2026-03-14 |
| 139 | Component extraction | full | server/index.js /api/ai/html-refactor type=component AI pattern normalisation; dashboard/src/components/ComponentLibrary.tsx | - | 2026-03-14 |
| 140 | Clean export preparation | full | server/index.js export validation/buildLocalizedArtifacts; server/deliveryArtifacts.js manifest/readiness | - | 2026-03-14 |
| 141 | URL crawler | full | server/projectImport.js importFromUrl crawl mode; dashboard/src/api/projects.ts mode crawl | - | 2026-03-14 |
| 142 | Sitemap extraction | full | server/projectImport.js discoverSitemapUrls/extractSitemapLocs; dashboard/src/api/projects.ts mode sitemap | - | 2026-03-14 |
| 143 | Asset extraction | full | server/projectImport.js assetFiles/localizedAssets; dashboard/src/editorHelpers.ts collectProjectAssets | - | 2026-03-14 |
| 144 | Image download | full | server/projectImport.js localized asset download; server/rewriteAssets.js | - | 2026-03-14 |
| 145 | CSS extraction | full | server/index.js /api/ai/html-refactor type=css_cleanup AI CSS dedup+variable extraction; server/deliveryArtifacts.js cleanupStyleBlocks | - | 2026-03-14 |
| 146 | Font detection | full | server/assistant.js brand_brain font_families extraction; dashboard/src/components/FontManager.tsx typography UI + brand_brain font data | - | 2026-03-14 |
| 147 | Screenshot import | full | server/projectImport.js importScreenshot; dashboard/src/api/projects.ts kind screenshot | - | 2026-03-14 |
| 148 | PDF import | full | server/projectImport.js importPdfBrief/extractPdfTextFallback; dashboard/src/api/projects.ts fileName/mimeType | - | 2026-03-14 |
| 149 | HTML import | full | server/projectImport.js normalizeImportedEntries/importProjectFromEntries; dashboard/src/api/projects.ts kind entries | - | 2026-03-14 |
| 150 | WordPress parser | full | server/siteMeta.js WordPress signals; server/projectImport.js WORDPRESS_THEME_SIGNALS | - | 2026-03-14 |
| 151 | Clean HTML export | full | server/index.js /api/export mode html-clean; dashboard/src/editorHelpers.ts EXPORT_MODE_OPTIONS | - | 2026-03-14 |
| 152 | Raw HTML export | full | server/index.js /api/export mode html-raw; dashboard/src/editorHelpers.ts EXPORT_MODE_OPTIONS | - | 2026-03-14 |
| 153 | WordPress theme export | full | server/index.js appendExportBundle wp-theme; dashboard/src/editorHelpers.ts EXPORT_MODE_OPTIONS | - | 2026-03-14 |
| 154 | WordPress block export | full | server/index.js appendExportBundle wp-block; dashboard/src/editorHelpers.ts EXPORT_MODE_OPTIONS | - | 2026-03-14 |
| 155 | Shopify section export | full | server/publish.js generateShopifySection; server/index.js appendExportBundle shopify-section | - | 2026-03-14 |
| 156 | React component export | full | server/index.js appendExportBundle react-component; dashboard/src/editorHelpers.ts EXPORT_MODE_OPTIONS | - | 2026-03-14 |
| 157 | Web component export | full | server/index.js appendExportBundle web-component; dashboard/src/editorHelpers.ts EXPORT_MODE_OPTIONS | - | 2026-03-14 |
| 158 | Webflow JSON export | full | server/index.js appendExportBundle webflow-json; dashboard/src/editorHelpers.ts EXPORT_MODE_OPTIONS | - | 2026-03-14 |
| 159 | Email template export | full | server/index.js appendExportBundle email-newsletter; dashboard/src/editorHelpers.ts EXPORT_MODE_OPTIONS | - | 2026-03-14 |
| 160 | Markdown export | full | server/index.js appendExportBundle markdown-content; server/deliveryArtifacts.js prepareMarkdownFile | - | 2026-03-14 |
| 161 | Publish preview | full | dashboard/src/App.tsx createPublishPreview; server/publish.js /api/projects/:id/publish/preview | - | 2026-03-14 |
| 162 | Share preview links | full | dashboard/src/App.tsx createSharePreview/projectShares; dashboard/src/api/projects.ts apiCreateProjectShare | - | 2026-03-14 |
| 163 | Deployment targets | full | dashboard/src/App.tsx loadPublishTargets; server/publish.js /api/publish/targets | - | 2026-03-14 |
| 164 | Custom domains | full | server/publish.js custom-domain DNS guide + CNAME/A record generation; dashboard/src/App.tsx loadCustomDomainGuide | - | 2026-03-14 |
| 165 | Deployment history | full | dashboard/src/App.tsx loadPublishHistory/recentPublishHistory; server/publish.js /api/projects/:id/publish/history | - | 2026-03-14 |
| 166 | Rollback deployment | full | dashboard/src/App.tsx rollbackPublishedDeployment; server/publish.js rollback route | - | 2026-03-14 |
| 167 | Static site export | full | server/index.js html-clean/html-raw export ZIP; dashboard/src/export.ts export filename map | - | 2026-03-14 |
| 168 | Netlify deploy | full | server/publish.js netlifyDeploy; dashboard/src/App.tsx publish target options | - | 2026-03-14 |
| 169 | CDN compatibility | full | server/deliveryArtifacts.js resolveExportAssets/rewriteInternalLinks with CDN base URL support; server/publish.js CDN deploy manifests | - | 2026-03-14 |
| 170 | Download package | full | server/index.js streams ZIP attachment; dashboard/src/editorHelpers.ts getDownloadFilename | - | 2026-03-14 |
| 171 | Organization creation | full | dashboard/src/components/SettingsPanel.tsx createOrg; server/organisations.js POST /api/orgs | - | 2026-03-14 |
| 172 | Team workspaces | full | dashboard/src/components/ProjectDashboard.tsx dashboardScope private/team/org filtering; dashboard/src/components/TeamSettings.tsx full org management UI | - | 2026-03-14 |
| 173 | Member invitations | full | dashboard/src/components/SettingsPanel.tsx invite; server/organisations.js POST /api/orgs/:id/invite and /api/orgs/accept-invite | - | 2026-03-14 |
| 174 | Role management | full | dashboard/src/components/SettingsPanel.tsx inviteRole selector; server/accessControl.js AGENCY_ROLES/normalizeAgencyRole | - | 2026-03-14 |
| 175 | Permissions | full | server/accessControl.js canAdvanceWorkflow/canExportProject/canInviteWithRole; server/organisations.js role enforcement on all org routes | - | 2026-03-14 |
| 176 | Project sharing | full | server/projects.js /api/projects/:id/share /shares; dashboard/src/api/projects.ts apiCreateProjectShare | - | 2026-03-14 |
| 177 | Shared previews | full | server/index.js /share/:token; server/publish.js /publish-preview/:token | - | 2026-03-14 |
| 178 | Activity logs | full | server/projects.js /api/projects/:id/activity; dashboard/src/api/projects.ts apiGetProjectActivity | - | 2026-03-14 |
| 179 | Collaboration workflow | full | server/projects.js workflow/share/activity routes; dashboard/src/components/ProjectDashboard.tsx stage/status UI | - | 2026-03-14 |
| 180 | Team settings | full | dashboard/src/components/TeamSettings.tsx full create/select org/invite/manage members UI via /api/orgs routes | - | 2026-03-14 |
| 181 | API key management | full | dashboard/src/components/SettingsPanel.tsx apikeys tab/detectKey; server/settings.js /api/settings and /api/settings/test-key | - | 2026-03-14 |
| 182 | Model selection | full | dashboard/src/components/SettingsPanel.tsx keyDetectedModels/model selection UI; dashboard/src/App.tsx leftAiModel | - | 2026-03-14 |
| 183 | Provider auto-detection | full | server/organisations.js detectProvider; dashboard/src/components/SettingsPanel.tsx providerLabel detection | - | 2026-03-14 |
| 184 | AI enable/disable toggles | full | dashboard/src/components/SettingsPanel.tsx disabled_models toggles; server/settings.js disabled_models persistence | - | 2026-03-14 |
| 185 | Theme settings | full | server/settings.js theme persistence; dashboard/src/utils/theme.ts applyThemeToDocument | - | 2026-03-14 |
| 186 | Dark/light mode | full | dashboard/src/utils/theme.ts preference handling; dashboard/src/main.tsx system theme sync | - | 2026-03-14 |
| 187 | Keyboard shortcuts | full | dashboard/src/hooks/useShortcuts.ts; dashboard/src/components/KeyboardShortcuts.tsx | - | 2026-03-14 |
| 188 | Approval workflows | full | dashboard/src/approval-settings.ts shouldApprove; server/projects.js approval routes; dashboard/src/App.tsx AI approval queue | - | 2026-03-14 |
| 189 | Local AI integration | full | server/ollama.js ollamaHealth/ollamaRewriteBlock; server/index.js /api/ai/ollama-health | - | 2026-03-14 |
| 190 | Organization settings | full | server/organisations.js /api/orgs full CRUD; dashboard/src/components/TeamSettings.tsx org settings UI + member management | - | 2026-03-14 |
| 191 | Audit logging | full | server/auditLog.js logAudit; server/db.js audit_logs table | - | 2026-03-14 |
| 192 | API rate limiting | full | server/auth.js registerRateLimit/loginRateLimit/forgotPasswordRateLimit; server/rateLimit.js createRateLimit | - | 2026-03-14 |
| 193 | Security validation | full | server/validation.js request validators; server/index.js POST /api/validate/html-safety XSS/injection detection; server/auth.js HTTPS/avatar validation | - | 2026-03-14 |
| 194 | Data storage | full | server/db.js better-sqlite3 schema/tables; server/projects.js and server/auth.js persistent CRUD | - | 2026-03-14 |
| 195 | Asset library merging | full | dashboard/src/editorHelpers.ts mergeAssetLibraries; dashboard/src/App.tsx asset library merge/save | - | 2026-03-14 |
| 196 | Translation pipeline | full | dashboard/src/utils/htmlTranslation.ts extraction/apply overrides; server/index.js buildLocalizedArtifacts | - | 2026-03-14 |
| 197 | Export build pipeline | full | server/index.js /api/export buildLocalizedArtifacts/appendExportBundle; server/deliveryArtifacts.js artifact builders | - | 2026-03-14 |
| 198 | AI usage telemetry | full | server/index.js GET /api/usage/stats by_tool/by_day/period; dashboard/src/App.tsx trackUsage/sessionCost | - | 2026-03-14 |
| 199 | Admin dashboard | full | dashboard/src/App.tsx Admin Console; dashboard/src/hooks/useAdmin.ts admin actions; server/index.js /api/admin/users | - | 2026-03-14 |
| 200 | Feature flag system | full | server/featureFlags.js FEATURE_FLAGS; server/index.js /api/feature-flags | - | 2026-03-14 |

## 308 YC Tracking

| YC ID | Requirement | Tag | Status | Evidence (file/function) | Linked Feature # | Last Update |
|---|---|---|---|---|---|---|
| a1 | User can register with email + password | - | todo | - | - | 2026-03-13 |
| a2 | Email validation on registration (format check + uniqueness) | - | todo | - | - | 2026-03-13 |
| a3 | Password strength requirements enforced | - | todo | - | - | 2026-03-13 |
| a4 | Email verification sent on signup | - | todo | - | - | 2026-03-13 |
| a5 | Duplicate email registration rejected with clear error | - | todo | - | - | 2026-03-13 |
| a6 | User can log in with email + password | - | todo | - | - | 2026-03-13 |
| a7 | Session persists on page reload (session restore) | - | todo | - | - | 2026-03-13 |
| a8 | User can log out from any page | - | todo | - | - | 2026-03-13 |
| a9 | Failed login shows clear error (no user / wrong password) | - | todo | - | - | 2026-03-13 |
| a10 | Session expires after inactivity (configurable timeout) | - | todo | - | - | 2026-03-13 |
| a11 | JWT or equivalent token-based auth | - | todo | - | - | 2026-03-13 |
| a12 | Refresh token flow (silent re-auth without re-login) | - | todo | - | - | 2026-03-13 |
| a13 | Forgot password flow — user enters email | - | todo | - | - | 2026-03-13 |
| a14 | Password reset email sent with secure time-limited link | - | todo | - | - | 2026-03-13 |
| a15 | Reset link expires after use or after 1 hour | - | todo | - | - | 2026-03-13 |
| a16 | User can set new password on reset page | - | todo | - | - | 2026-03-13 |
| a17 | Invalid/expired reset link shows clear error | - | todo | - | - | 2026-03-13 |
| a18 | User can change their email address | - | todo | - | - | 2026-03-13 |
| a19 | User can change their password from settings | - | todo | - | - | 2026-03-13 |
| a20 | User can upload / change profile avatar | - | todo | - | - | 2026-03-13 |
| a21 | User can update display name | - | todo | - | - | 2026-03-13 |
| a22 | User can delete their account (with confirmation) | YC | todo | - | - | 2026-03-13 |
| a23 | GDPR data export (download all user data) | YC | todo | - | - | 2026-03-13 |
| a24 | Rate limiting on login attempts (brute force protection) (Lock after N failed attempts or add captcha) | Critical | todo | - | - | 2026-03-13 |
| a25 | Two-factor authentication (TOTP / email OTP) | YC | todo | - | - | 2026-03-13 |
| a26 | OAuth login (Google at minimum) | YC | todo | - | - | 2026-03-13 |
| a27 | Passwords hashed with bcrypt or argon2 (never plain text) | Critical | todo | - | - | 2026-03-13 |
| a28 | All auth endpoints use HTTPS | Critical | todo | - | - | 2026-03-13 |
| b1 | Multiple plan tiers (Free / Pro / Agency or similar) | - | todo | - | - | 2026-03-13 |
| b2 | Features gated per plan (editor limits, AI access, exports) | - | todo | - | - | 2026-03-13 |
| b3 | User can view current plan details | - | todo | - | - | 2026-03-13 |
| b4 | User can upgrade plan | - | todo | - | - | 2026-03-13 |
| b5 | User can downgrade plan | - | todo | - | - | 2026-03-13 |
| b6 | Admin can change any user's plan | - | todo | - | - | 2026-03-13 |
| b7 | Plan comparison page / pricing page publicly visible | YC | todo | - | - | 2026-03-13 |
| b8 | Per-user credit balance tracked in real time | - | todo | - | - | 2026-03-13 |
| b9 | AI actions deduct credits with accurate cost calculation | - | todo | - | - | 2026-03-13 |
| b10 | User sees credit balance before confirming an AI action | - | todo | - | - | 2026-03-13 |
| b11 | Action blocked if insufficient credits (clear error message) | - | todo | - | - | 2026-03-13 |
| b12 | Top-up flow — user can buy more credits | - | todo | - | - | 2026-03-13 |
| b13 | Credit transaction history visible to user | - | todo | - | - | 2026-03-13 |
| b14 | Monthly credit reset or rollover logic clearly defined | - | todo | - | - | 2026-03-13 |
| b15 | Stripe (or equivalent) integration for card payments | Critical | todo | - | - | 2026-03-13 |
| b16 | Subscription billing — recurring charges work correctly | Critical | todo | - | - | 2026-03-13 |
| b17 | Payment failure handled gracefully (retry, email notification) | - | todo | - | - | 2026-03-13 |
| b18 | Invoice / receipt generated per payment | YC | todo | - | - | 2026-03-13 |
| b19 | User can cancel subscription (self-serve) | YC | todo | - | - | 2026-03-13 |
| b20 | Refund policy visible and refunds possible via admin | - | todo | - | - | 2026-03-13 |
| b21 | VAT / tax handling for EU customers | YC | todo | - | - | 2026-03-13 |
| d1 | Dark mode — full dashboard, editor, settings | - | todo | - | - | 2026-03-13 |
| d2 | Light mode — full dashboard, editor, settings | - | todo | - | - | 2026-03-13 |
| d3 | Theme preference saved per user (persists across sessions) | - | todo | - | - | 2026-03-13 |
| d4 | System theme preference respected (prefers-color-scheme) | - | todo | - | - | 2026-03-13 |
| d5 | Main nav: Projects, Templates, Exports, AI Studio workspaces | - | todo | - | - | 2026-03-13 |
| d6 | Global search across projects, pages, templates | - | todo | - | - | 2026-03-13 |
| d7 | Keyboard shortcuts for common actions | YC | todo | - | - | 2026-03-13 |
| d8 | Breadcrumb navigation inside project / page / editor | - | todo | - | - | 2026-03-13 |
| d9 | Mobile-responsive dashboard (usable on tablet) | - | todo | - | - | 2026-03-13 |
| d10 | Empty states with helpful CTAs (no blank screens) | - | todo | - | - | 2026-03-13 |
| d11 | Loading states / skeletons (no unstyled loading) | - | todo | - | - | 2026-03-13 |
| d12 | Error boundaries — app doesn't white-screen on JS errors | Critical | todo | - | - | 2026-03-13 |
| d13 | Toast / notification system for actions (success, error, info) | - | todo | - | - | 2026-03-13 |
| d14 | All interactive elements keyboard-navigable | YC | todo | - | - | 2026-03-13 |
| d15 | Focus indicators visible on all interactive elements | - | todo | - | - | 2026-03-13 |
| d16 | WCAG AA contrast ratio on all text | - | todo | - | - | 2026-03-13 |
| d17 | Semantic HTML / ARIA labels on key components | - | todo | - | - | 2026-03-13 |
| d18 | Profile settings page (name, avatar, email, password) | - | todo | - | - | 2026-03-13 |
| d19 | Billing settings page (plan, invoices, payment method) | - | todo | - | - | 2026-03-13 |
| d20 | AI model settings (grouped: Chat, Image, Video, Code, Extras) | - | todo | - | - | 2026-03-13 |
| d21 | Notification preferences page | - | todo | - | - | 2026-03-13 |
| d22 | API key management page (for power users / integrations) | YC | todo | - | - | 2026-03-13 |
| p1 | Create new project (blank) | - | todo | - | - | 2026-03-13 |
| p2 | Open existing project | - | todo | - | - | 2026-03-13 |
| p3 | Rename project | - | todo | - | - | 2026-03-13 |
| p4 | Duplicate project | - | todo | - | - | 2026-03-13 |
| p5 | Delete project (with confirmation) | - | todo | - | - | 2026-03-13 |
| p6 | Restore deleted project (soft delete + restore) | - | todo | - | - | 2026-03-13 |
| p7 | Pin / unpin project to top of dashboard | - | todo | - | - | 2026-03-13 |
| p8 | Search projects by name | - | todo | - | - | 2026-03-13 |
| p9 | Filter projects by status / assignee / tag | - | todo | - | - | 2026-03-13 |
| p10 | Sort projects (newest, name, last edited) | - | todo | - | - | 2026-03-13 |
| p11 | Stage tracking (Draft / In Review / Complete / etc.) | - | todo | - | - | 2026-03-13 |
| p12 | Due date set per project | - | todo | - | - | 2026-03-13 |
| p13 | Client name stored per project | - | todo | - | - | 2026-03-13 |
| p14 | Assignees set per project | - | todo | - | - | 2026-03-13 |
| p15 | Export history visible per project | - | todo | - | - | 2026-03-13 |
| p16 | Workflow / AI action history visible per project | - | todo | - | - | 2026-03-13 |
| p17 | Project thumbnail / preview image auto-generated | - | todo | - | - | 2026-03-13 |
| p18 | Project tags / labels for organisation | - | todo | - | - | 2026-03-13 |
| p19 | One project holds multiple pages | USP | todo | - | - | 2026-03-13 |
| p20 | Page explorer view inside project (not forced into editor) | - | todo | - | - | 2026-03-13 |
| p21 | Internal links scanned and stored as project pages | USP | todo | - | - | 2026-03-13 |
| p22 | Add new page to existing project manually | - | todo | - | - | 2026-03-13 |
| p23 | Delete a page from a project | - | todo | - | - | 2026-03-13 |
| p24 | Page-level metadata (title, slug, SEO fields) | - | todo | - | - | 2026-03-13 |
| p25 | Shared components/templates reused across pages in project | YC | todo | - | - | 2026-03-13 |
| i1 | Import homepage from live URL | USP | todo | - | - | 2026-03-13 |
| i2 | Same-origin page scan (crawl all pages on same domain) | USP | todo | - | - | 2026-03-13 |
| i3 | Sitemap-based import (parse sitemap.xml and import all pages) | USP | todo | - | - | 2026-03-13 |
| i4 | Internal links extracted and stored as page list | - | todo | - | - | 2026-03-13 |
| i5 | Assets (images, fonts, CSS, JS) downloaded and localised | Critical | todo | - | - | 2026-03-13 |
| i6 | Import handles redirect chains (301, 302) | - | todo | - | - | 2026-03-13 |
| i7 | Import behind basic auth or with cookie/header injection | YC | todo | - | - | 2026-03-13 |
| i8 | Import success rate tracked and reported (target >95%) | Critical | todo | - | - | 2026-03-13 |
| i9 | Upload single HTML file | - | todo | - | - | 2026-03-13 |
| i10 | Upload ZIP archive (full site or theme) | USP | todo | - | - | 2026-03-13 |
| i11 | Upload folder (drag-and-drop entire folder) | USP | todo | - | - | 2026-03-13 |
| i12 | Upload screenshot / image (AI reconstructs layout) | USP | todo | - | - | 2026-03-13 |
| i13 | Upload brief / text doc (AI generates structure from brief) | USP | todo | - | - | 2026-03-13 |
| i14 | Upload asset pack (images, fonts, brand kit) | - | todo | - | - | 2026-03-13 |
| i15 | Upload Figma export (PNG/SVG frames → layout reconstruction) | YC | todo | - | - | 2026-03-13 |
| i16 | Distinguishes page templates from assets, support files, style files | USP | todo | - | - | 2026-03-13 |
| i17 | WordPress-aware: front-page.php, functions.php treated semantically | USP | todo | - | - | 2026-03-13 |
| i18 | Locale / language files detected and separated | - | todo | - | - | 2026-03-13 |
| i19 | Repeated section / component detection across pages | Critical | todo | - | - | 2026-03-13 |
| i20 | Nav structure reconstructed (primary nav, footer nav) | Critical | todo | - | - | 2026-03-13 |
| i21 | Forms and CTAs preserved through import | Critical | todo | - | - | 2026-03-13 |
| i22 | Gemini used to refine structural interpretation of messy uploads | USP | todo | - | - | 2026-03-13 |
| i23 | Import fidelity score generated per project (before/after diff) | YC | todo | - | - | 2026-03-13 |
| i24 | Import preview before committing (user sees result before saving) | YC | todo | - | - | 2026-03-13 |
| i25 | SEO metadata (title, description, og tags) preserved on import | Critical | todo | - | - | 2026-03-13 |
| e1 | Live iframe preview renders actual page HTML | - | todo | - | - | 2026-03-13 |
| e2 | Block overlay system identifies editable sections | - | todo | - | - | 2026-03-13 |
| e3 | Click to select a block | - | todo | - | - | 2026-03-13 |
| e4 | Inline text editing (double-click to edit text in place) | - | todo | - | - | 2026-03-13 |
| e5 | Block movement (drag to reorder or move up/down) | - | todo | - | - | 2026-03-13 |
| e6 | Block split (split one block into two) | - | todo | - | - | 2026-03-13 |
| e7 | Block delete | - | todo | - | - | 2026-03-13 |
| e8 | Insert new component / block between existing blocks | - | todo | - | - | 2026-03-13 |
| e9 | Block family filter (filter visible blocks by type) | - | todo | - | - | 2026-03-13 |
| e10 | Structure snapshot sent from iframe to app UI | - | todo | - | - | 2026-03-13 |
| e11 | Save / auto-save edited state | Critical | todo | - | - | 2026-03-13 |
| e12 | Undo / redo (Ctrl+Z) within editor session | Critical | todo | - | - | 2026-03-13 |
| e13 | Replace image in block (upload or URL) | - | todo | - | - | 2026-03-13 |
| e14 | Image resize / crop within editor | - | todo | - | - | 2026-03-13 |
| e15 | AI image generation inline in editor | YC | todo | - | - | 2026-03-13 |
| e16 | Asset library per project (all uploaded images/fonts accessible) | - | todo | - | - | 2026-03-13 |
| e17 | Color picker for text / background / border | - | todo | - | - | 2026-03-13 |
| e18 | Typography controls (font, size, weight, line height) | - | todo | - | - | 2026-03-13 |
| e19 | Spacing controls (padding, margin per block) | - | todo | - | - | 2026-03-13 |
| e20 | Global style overrides (site-wide font / color changes) | YC | todo | - | - | 2026-03-13 |
| e21 | CSS custom properties / variables panel | YC | todo | - | - | 2026-03-13 |
| e22 | Raw HTML / code view per block (for developers) | - | todo | - | - | 2026-03-13 |
| e23 | Desktop / tablet / mobile preview toggle in editor | - | todo | - | - | 2026-03-13 |
| e24 | Full-page preview (no UI chrome, just the page) | - | todo | - | - | 2026-03-13 |
| e25 | Share preview link (public URL showing current state) | YC | todo | - | - | 2026-03-13 |
| ai1 | AI rewrite selected block (text content) | - | todo | - | - | 2026-03-13 |
| ai2 | AI rewrite with custom prompt / instruction | - | todo | - | - | 2026-03-13 |
| ai3 | Streaming rewrite (text appears as it generates) | - | todo | - | - | 2026-03-13 |
| ai4 | AI tone options (professional, casual, persuasive, etc.) | - | todo | - | - | 2026-03-13 |
| ai5 | Accept or reject AI suggestion (diff view preferred) | Critical | todo | - | - | 2026-03-13 |
| ai6 | AI suggest layout improvement for block | - | todo | - | - | 2026-03-13 |
| ai7 | Full page AI rescan (re-analyse all blocks) | - | todo | - | - | 2026-03-13 |
| ai8 | AI SEO audit of full page (title, meta, headings, alt text) | YC | todo | - | - | 2026-03-13 |
| ai9 | AI CRO audit (suggest CTA, headline, layout improvements) | YC | todo | - | - | 2026-03-13 |
| ai10 | AI accessibility audit (missing alt text, contrast, labels) | - | todo | - | - | 2026-03-13 |
| ai11 | Batch AI action across multiple pages | USP | todo | - | - | 2026-03-13 |
| ai12 | AI actions require approval before execution (configurable) | - | todo | - | - | 2026-03-13 |
| ai13 | Approval flow: action queued, user approves, then continues | - | todo | - | - | 2026-03-13 |
| ai14 | Credit cost shown before any AI action | Critical | todo | - | - | 2026-03-13 |
| ai15 | Server-side model routing (choose best model per task type) | - | todo | - | - | 2026-03-13 |
| ai16 | AI context-aware: knows current workspace / project / block | - | todo | - | - | 2026-03-13 |
| ai17 | Bottom-right context-aware AI copilot widget | - | todo | - | - | 2026-03-13 |
| ai18 | Assistant knows current workspace / project / block / export context | - | todo | - | - | 2026-03-13 |
| ai19 | Plan-based model access (higher plan = better model) | - | todo | - | - | 2026-03-13 |
| ai20 | Chat history per session | - | todo | - | - | 2026-03-13 |
| ai21 | Assistant can take actions (trigger exports, translations, rewrites) | YC | todo | - | - | 2026-03-13 |
| t1 | Translate full page into any of 50+ languages | USP | todo | - | - | 2026-03-13 |
| t2 | Only text nodes and translatable attributes rewritten (DOM preserved) | USP | todo | - | - | 2026-03-13 |
| t3 | Block overlays still work after translation | - | todo | - | - | 2026-03-13 |
| t4 | Translated page exportable in all 10 formats | USP | todo | - | - | 2026-03-13 |
| t5 | Translation quality review UI (highlight translated segments) | - | todo | - | - | 2026-03-13 |
| t6 | Manual override of any translated segment | - | todo | - | - | 2026-03-13 |
| t7 | Store language variants per page (not just overwrite current state) | Critical | todo | - | - | 2026-03-13 |
| t8 | Side-by-side editor: original language vs translated | YC | todo | - | - | 2026-03-13 |
| t9 | Switch between language variants in editor without re-translating | - | todo | - | - | 2026-03-13 |
| t10 | Export all language variants as separate output bundle | YC | todo | - | - | 2026-03-13 |
| t11 | Hreflang tags auto-generated in exported HTML | YC | todo | - | - | 2026-03-13 |
| ex1 | HTML Clean — readable, production-ready HTML/CSS | USP | todo | - | - | 2026-03-13 |
| ex2 | HTML Raw — unmodified source HTML | - | todo | - | - | 2026-03-13 |
| ex3 | WordPress Theme — full installable .zip theme | USP | todo | - | - | 2026-03-13 |
| ex4 | WordPress Block — Gutenberg-compatible block(s) | USP | todo | - | - | 2026-03-13 |
| ex5 | WordPress Placeholder — lightweight template placeholder | - | todo | - | - | 2026-03-13 |
| ex6 | Shopify Section — valid Liquid section file | USP | todo | - | - | 2026-03-13 |
| ex7 | Web Component — standalone custom element | USP | todo | - | - | 2026-03-13 |
| ex8 | Email Newsletter — inline-CSS, table-based email HTML | USP | todo | - | - | 2026-03-13 |
| ex9 | Markdown — clean .md file (content extracted) | - | todo | - | - | 2026-03-13 |
| ex10 | PDF Print — print-ready PDF from page layout | - | todo | - | - | 2026-03-13 |
| ex11 | React component export (JSX) | YC | todo | - | - | 2026-03-13 |
| ex12 | Webflow JSON import format | YC | todo | - | - | 2026-03-13 |
| ex13 | SEO metadata (title, meta description, og tags) in every export | Critical | todo | - | - | 2026-03-13 |
| ex14 | All assets (images, fonts) correctly linked in output | Critical | todo | - | - | 2026-03-13 |
| ex15 | Internal links preserved and correct in output | Critical | todo | - | - | 2026-03-13 |
| ex16 | Forms functional in target environment after export | Critical | todo | - | - | 2026-03-13 |
| ex17 | HTML valid (passes W3C validator) | - | todo | - | - | 2026-03-13 |
| ex18 | CSS clean (no orphaned rules, no inline bloat) | - | todo | - | - | 2026-03-13 |
| ex19 | Export validated before delivery (readiness state + warnings) | - | todo | - | - | 2026-03-13 |
| ex20 | Manifest + delivery notes in every export ZIP | - | todo | - | - | 2026-03-13 |
| ex21 | Export pass rate tracked (target >98% valid exports) | YC | todo | - | - | 2026-03-13 |
| ex22 | Target-native editability: WordPress export editable in WP, Shopify in Shopify | Critical | todo | - | - | 2026-03-13 |
| pub1 | Deploy to Firebase Hosting (one-click from dashboard) | Critical | todo | - | - | 2026-03-13 |
| pub2 | Deploy to Netlify (one-click or drag-drop integration) | Critical | todo | - | - | 2026-03-13 |
| pub3 | Deploy to Vercel | YC | todo | - | - | 2026-03-13 |
| pub4 | Push to WordPress install via WP-CLI / REST API | YC | todo | - | - | 2026-03-13 |
| pub5 | Push to Shopify store via Shopify API | YC | todo | - | - | 2026-03-13 |
| pub6 | Custom domain mapping for hosted projects | YC | todo | - | - | 2026-03-13 |
| pub7 | Preview URL generated before final publish | - | todo | - | - | 2026-03-13 |
| pub8 | Publish history (list of all deployments per project) | - | todo | - | - | 2026-03-13 |
| pub9 | Rollback to previous deployment | YC | todo | - | - | 2026-03-13 |
| s1 | Autonomous CRO Agent — analyses page, suggests + applies CRO improvements | USP | todo | - | - | 2026-03-13 |
| s2 | Self-Healing Website — detects broken elements, auto-fixes | USP | todo | - | - | 2026-03-13 |
| s3 | One-Click Global Expansion — translate + adapt for new market | USP | todo | - | - | 2026-03-13 |
| s4 | Brand Brain — extract and store brand voice/style from existing site | - | todo | - | - | 2026-03-13 |
| s5 | Competitor War Room — competitive analysis with AI research | - | todo | - | - | 2026-03-13 |
| s6 | Personalized Site per Visitor — rules/segments for dynamic content | USP | todo | - | - | 2026-03-13 |
| s7 | Company-in-a-Box — full website + brand from company description | - | todo | - | - | 2026-03-13 |
| s8 | Figma / Screenshot → Product — image to editable page | - | todo | - | - | 2026-03-13 |
| s9 | Full Funnel Generator — landing page + thank you + email sequence | - | todo | - | - | 2026-03-13 |
| s10 | AI Sales Closer — optimise page for conversion with A/B suggestions | - | todo | - | - | 2026-03-13 |
| s11 | Save run history per AI Studio tool | Critical | todo | - | - | 2026-03-13 |
| s12 | View outputs from previous runs | Critical | todo | - | - | 2026-03-13 |
| s13 | Re-run / refresh a previous run | - | todo | - | - | 2026-03-13 |
| s14 | Compare runs side by side | YC | todo | - | - | 2026-03-13 |
| s15 | Plan gating per tool (which plans access which tools) | - | todo | - | - | 2026-03-13 |
| s16 | Each tool is either fully autonomous or clearly labelled as "guided" | Critical | todo | - | - | 2026-03-13 |
| v1 | Auto-save version snapshot on every significant edit | Critical | todo | - | - | 2026-03-13 |
| v2 | Named manual snapshots ("Before AI rewrite", "Client approved v2") | Critical | todo | - | - | 2026-03-13 |
| v3 | Version history list per page (timestamp + action label) | Critical | todo | - | - | 2026-03-13 |
| v4 | Preview any historical version | Critical | todo | - | - | 2026-03-13 |
| v5 | Restore (rollback) to any previous version | Critical | todo | - | - | 2026-03-13 |
| v6 | Diff view: compare current state vs previous version (visual) | YC | todo | - | - | 2026-03-13 |
| v7 | Version history per project (not just per page) | - | todo | - | - | 2026-03-13 |
| v8 | Auto-snapshot before every AI action (safe default) | Critical | todo | - | - | 2026-03-13 |
| tm1 | Create organisation | - | todo | - | - | 2026-03-13 |
| tm2 | Invite member to org by email | - | todo | - | - | 2026-03-13 |
| tm3 | Remove member from org | - | todo | - | - | 2026-03-13 |
| tm4 | Roles: Owner, Admin, Editor, Viewer | YC | todo | - | - | 2026-03-13 |
| tm5 | Permissions enforced per role (viewer can't edit, etc.) | YC | todo | - | - | 2026-03-13 |
| tm6 | Project assignees (assign project to specific team members) | - | todo | - | - | 2026-03-13 |
| tm7 | Comments / annotation on blocks (for review workflow) | YC | todo | - | - | 2026-03-13 |
| tm8 | Client share link (client can view/comment without account) | YC | todo | - | - | 2026-03-13 |
| tm9 | Approval / sign-off workflow (client approves before export) | YC | todo | - | - | 2026-03-13 |
| ad1 | View all users with search and filter | - | todo | - | - | 2026-03-13 |
| ad2 | Change any user's plan from admin | - | todo | - | - | 2026-03-13 |
| ad3 | Adjust any user's credit balance from admin | - | todo | - | - | 2026-03-13 |
| ad4 | Send password reset email from admin | - | todo | - | - | 2026-03-13 |
| ad5 | Suspend / ban user account | - | todo | - | - | 2026-03-13 |
| ad6 | Impersonate user (for debugging with permission) | - | todo | - | - | 2026-03-13 |
| ad7 | Audit log — every admin action recorded with timestamp + actor | YC | todo | - | - | 2026-03-13 |
| ad8 | Dashboard: new signups per day/week/month | YC | todo | - | - | 2026-03-13 |
| ad9 | Dashboard: MRR and revenue over time | YC | todo | - | - | 2026-03-13 |
| ad10 | Dashboard: AI credit usage per model per day | - | todo | - | - | 2026-03-13 |
| ad11 | Dashboard: import success/fail rate | YC | todo | - | - | 2026-03-13 |
| ad12 | Dashboard: export success/fail rate per format | YC | todo | - | - | 2026-03-13 |
| ad13 | Dashboard: churn rate and retention cohorts | YC | todo | - | - | 2026-03-13 |
| r1 | Unit tests for import pipeline (each source type) | Critical | todo | - | - | 2026-03-13 |
| r2 | Unit tests for export pipeline (each format) | Critical | todo | - | - | 2026-03-13 |
| r3 | Integration tests: import → edit → export full flow | Critical | todo | - | - | 2026-03-13 |
| r4 | E2E tests for auth flow (register, login, reset password) | - | todo | - | - | 2026-03-13 |
| r5 | E2E tests for billing flow (subscribe, upgrade, cancel) | - | todo | - | - | 2026-03-13 |
| r6 | CI/CD pipeline — tests run on every push | - | todo | - | - | 2026-03-13 |
| r7 | Regression test suite for AI rewrites (before/after fidelity) | - | todo | - | - | 2026-03-13 |
| r8 | Error tracking (Sentry or equivalent) with alerts | Critical | todo | - | - | 2026-03-13 |
| r9 | Uptime monitoring with alerting | Critical | todo | - | - | 2026-03-13 |
| r10 | API rate limiting on all public endpoints | - | todo | - | - | 2026-03-13 |
| r11 | Database backups (daily automated) | Critical | todo | - | - | 2026-03-13 |
| r12 | Performance: dashboard loads in <2s on cold start | - | todo | - | - | 2026-03-13 |
| r13 | Performance: editor loads in <3s with imported content | - | todo | - | - | 2026-03-13 |
| r14 | Status page (public uptime history — builds trust) | YC | todo | - | - | 2026-03-13 |
| tr1 | 10+ paying customers (real money, not free tier) | PMF | todo | - | - | 2026-03-13 |
| tr2 | $2,000+ MRR from beachhead (agency migration use case) | PMF | todo | - | - | 2026-03-13 |
| tr3 | Week-over-week revenue growth for 4+ consecutive weeks | PMF | todo | - | - | 2026-03-13 |
| tr4 | At least 1 agency paying >$200/month | PMF | todo | - | - | 2026-03-13 |
| tr5 | Net Revenue Retention >100% (users upgrade, not churn) | PMF | todo | - | - | 2026-03-13 |
| tr6 | PMF survey sent: "How disappointed if you could no longer use edit?" — target >40% "Very disappointed" | PMF | todo | - | - | 2026-03-13 |
| tr7 | 20+ user interviews completed (documented pain + outcome) | PMF | todo | - | - | 2026-03-13 |
| tr8 | 1 case study published: real agency, real site, real time saved | PMF | todo | - | - | 2026-03-13 |
| tr9 | Quantified value prop: "X hours saved per site migration" (real data) | PMF | todo | - | - | 2026-03-13 |
| tr10 | NPS score tracked (target >50) | PMF | todo | - | - | 2026-03-13 |
| tr11 | Import success rate published (e.g. "94% of imports succeed") | YC | todo | - | - | 2026-03-13 |
| tr12 | Export pass rate published (e.g. "98% valid exports") | YC | todo | - | - | 2026-03-13 |
| tr13 | Average time saved per migration (benchmark vs manual rebuild) | YC | todo | - | - | 2026-03-13 |
| tr14 | Number of source types supported (published on landing page) | - | todo | - | - | 2026-03-13 |
| tr15 | Press / community mention in agency/webdev/indie hacker circles | YC | todo | - | - | 2026-03-13 |
| pos1 | One-sentence value prop on homepage (crystal clear, not generic) | Critical | todo | - | - | 2026-03-13 |
| pos2 | Primary beachhead clearly stated: "for agencies rebuilding client sites" | Critical | todo | - | - | 2026-03-13 |
| pos3 | Pricing page live and public | - | todo | - | - | 2026-03-13 |
| pos4 | Feature comparison vs top 3 competitors (on website) | YC | todo | - | - | 2026-03-13 |
| pos5 | Use-case landing pages (e.g. /agency-migration, /wordpress-to-shopify) | YC | todo | - | - | 2026-03-13 |
| pos6 | ProductHunt launch prepared | YC | todo | - | - | 2026-03-13 |
| pos7 | Indie Hackers / Hacker News Show HN post drafted | YC | todo | - | - | 2026-03-13 |
| pos8 | Active in 2–3 agency/webdev/indie hacker circles | YC | todo | - | - | 2026-03-13 |
| pos9 | Docs / help center live (search-friendly) | - | todo | - | - | 2026-03-13 |
| pos10 | Demo video (2 min: import a real site → edit → export) on homepage | Critical | todo | - | - | 2026-03-13 |
| yc1 | One-line company description written (50 words max, crystal clear) | YC | todo | - | - | 2026-03-13 |
| yc2 | Problem description written (what is the exact painful problem) | YC | todo | - | - | 2026-03-13 |
| yc3 | Solution description written (how you uniquely solve it) | YC | todo | - | - | 2026-03-13 |
| yc4 | Why now — why is this the right time for this product | YC | todo | - | - | 2026-03-13 |
| yc5 | Market size — TAM / SAM / SOM estimated with sources | YC | todo | - | - | 2026-03-13 |
| yc6 | Traction section: MRR, user count, growth rate, key metrics | YC | todo | - | - | 2026-03-13 |
| yc7 | Business model: how you charge, unit economics per customer | YC | todo | - | - | 2026-03-13 |
| yc8 | Competition section: who competes + why you win | YC | todo | - | - | 2026-03-13 |
| yc9 | Moat / defensibility: what makes this hard to copy | YC | todo | - | - | 2026-03-13 |
| yc10 | Team section: who you are, why you can build this | YC | todo | - | - | 2026-03-13 |
| yc11 | Video demo recorded: 2 min, shows real import → edit → export | YC | todo | - | - | 2026-03-13 |
| yc12 | Incorporated entity (Delaware C-Corp preferred for YC) | YC | todo | - | - | 2026-03-13 |
| yc13 | Equity / cap table clean (no messy pre-seed mess) | YC | todo | - | - | 2026-03-13 |
| yc14 | Applied to YC batch (or on waitlist for next batch) | YC | todo | - | - | 2026-03-13 |
