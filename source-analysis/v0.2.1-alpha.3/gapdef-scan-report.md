
########## dsh-v0.2.1-alpha.1 -> dsh-v0.2.1-alpha.2  (removed-export gaps: 41, added-export count: 304) ##########

### packages/boot (2)
- readPendingBuilds  @packages/boot/plugin-manager/src/build-approval.ts
- readPluginMeta  @packages/boot/app-boot/src/index.ts

### packages/bundle (2)
- resolveLanTrust  @packages/bundle/web-app/src/index.ts
- WebRuntimeValues  @packages/bundle/web-app/src/index.ts

### packages/client (2)
- createFontSizeRowStore  @packages/client/ui-theme/src/client/settings-store.ts
- FontSizeRowState  @packages/client/ui-theme/src/client/settings-store.ts

### packages/context (1)
- dedupInstructionFilesByDirectory  @packages/context/agent-instructions/src/files.ts

### packages/deliverables (1)
- mutationPath  @packages/deliverables/workspace-changes/src/capture.ts

### packages/experimental (3)
- getBuiltinProviders  @packages/experimental/webworker-runtime/src/node/external_packages/pi-ai.ts
- matcherDiagnostic,matchesMatcher  @packages/experimental/hook-protocol/src/index.ts
- TeamMailbox  @packages/experimental/agent-team/src/mailbox.ts

### packages/extensions (4)
- ApprovalRequestId  @packages/extensions/cordis-host-runner/src/index.ts
- CordisDynamicPackageId  @packages/extensions/cordis-host-runner/src/index.ts
- CordisDynamicPluginId  @packages/extensions/cordis-host-runner/src/index.ts
- CordisDynamicPluginRunId  @packages/extensions/cordis-host-runner/src/index.ts

### packages/fs (1)
- sessionCwd  @packages/fs/tool-fs/src/session-cwd.ts

### packages/lsp (1)
- sessionCwd  @packages/lsp/tool-lsp/src/index.ts, packages/lsp/tool-lsp/src/session-cwd.ts

### packages/sdk (1)
- DeepSeekHarness,HarnessSession  @packages/sdk/client/src/index.ts

### packages/session (3)
- generateSessionTitleWithLlm  @packages/session/session-title-llm/src/index.ts
- registerSessionTitleLlmProvider  @packages/session/session-title-llm/src/index.ts
- SessionTitleLlmMessageSelector  @packages/session/session-title-llm/src/index.ts

### packages/subagent (20)
- ActivationTerminal  @packages/subagent/subagent/src/lifecycle.ts
- ContinuableActivationRegistry  @packages/subagent/subagent/src/continuation-activation.ts
- ContinuableStart  @packages/subagent/subagent/src/types.ts
- ContinuableStartSpec  @packages/subagent/subagent/src/types.ts
- continuationActivations  @packages/subagent/subagent/tests/continuation-internals.ts
- continuationManager  @packages/subagent/subagent/tests/continuation-internals.ts
- dropContinuationActivation  @packages/subagent/subagent/tests/continuation-internals.ts
- fakeAgent  @packages/subagent/tool-subagent/tests/harness.ts
- InProcessRunOptions  @packages/subagent/subagent-in-process-driver/src/index.ts
- MaterializeInputs  @packages/subagent/subagent/src/continuation-activation.ts
- observeRun  @packages/subagent/subagent/src/lifecycle.ts
- OneShotSubagentDescriptorInput  @packages/subagent/subagent/src/descriptor.ts
- resolveChildCwd  @packages/subagent/subagent/src/out-of-process.ts
- settleRun  @packages/subagent/subagent/src/index.ts, packages/subagent/subagent/src/run-settlement.ts
- snapshotSubagentDescriptor  @packages/subagent/subagent/src/descriptor.ts
- startInProcessRun  @packages/subagent/subagent-in-process-driver/src/index.ts
- SubagentContinuationManager  @packages/subagent/subagent/src/continuation.ts
- SubagentDescriptorInput  @packages/subagent/subagent/src/descriptor.ts
- SubagentInbox  @packages/subagent/subagent/src/inbox.ts
- validateConfiguredCwd  @packages/subagent/subagent/src/out-of-process.ts

### [reshaped candidates] both removed & re-added in-window (50)
- apps::apply
- apps::inject
- apps::name
- packages/api::SessionProjectionsValue
- packages/client::AssistantMarkdownProps
- packages/client::ChatGroupSeat
- packages/client::FontSizeRow
- packages/client::InstallSubject
- packages/client::ReasoningRow
- packages/client::RowActionToast
- packages/client::TranscriptViewRow
- packages/client::isTrustedApiRequest
- packages/client::presentationPolicyFor
- packages/context::inject
- packages/core::ToolPresentationMode
- packages/deliverables::inject
- packages/experimental::getBuiltinModels
- packages/experimental::inject
- packages/experimental::register
- packages/fs::inject
- packages/fs::sessionResolveOptions
- packages/host::inject
- packages/llm::LlmCallConfig
- packages/lsp::inject
- packages/ptc-runtime::Config
- packages/ptc-runtime::LaunchConfig
- packages/ptc-runtime::bootstrapArgs
- packages/sdk::inject
- packages/session::Config
- packages/session::apply
- packages/session::inject
- packages/session::name
- packages/shell::inject
- packages/skill::inject
- packages/ssh::SSH_PROTOCOL_VERSION
- packages/ssh::createHelperHarness
- packages/ssh::helloSchema
- packages/subagent::Activation
- packages/subagent::ChildLock
- packages/subagent::ContinuableSubagentDescriptorInput
- packages/subagent::SubagentDelivery
- packages/subagent::attachStructuredRuntime
- packages/subagent::callSubagent
- packages/subagent::testToolSignal
- packages/subagent::waitForIdle
- packages/telemetry::createEventLogExporter
- packages/telemetry::createLogExporter
- packages/terminal::inject
- packages/workflow::fakeParent
- tests::experimentalRuntimeReferences

########## dsh-v0.2.1-alpha.2 -> dsh-v0.2.1-alpha.3  (removed-export gaps: 14, added-export count: 466) ##########

### apps (2)
- windowsCiSettings  @apps/desktop/scripts/prepare-windows-ci.d.mts, apps/desktop/scripts/prepare-windows-ci.mjs
- WindowsCiSettings  @apps/desktop/scripts/prepare-windows-ci.d.mts

### packages/api (1)
- TerminalAttachmentId  @packages/api/terminal-controller/src/types.ts

### packages/boot (3)
- addHarnessSourceSection  @packages/boot/app-boot/src/index.ts
- HARNESS_SOURCE_SECTION  @packages/boot/app-boot/src/index.ts
- readProfilePatches,resolveTelemetryPatch,type ProfileContext,type ProfilePnpmInvocation  @packages/boot/app-boot/src/index.ts

### packages/client (6)
- OperatorPeer  @packages/client/connection/src/index.ts, packages/client/connection/src/operator-peer.ts
- projectUserText  @packages/client/ui-primitives/src/user-text.tsx
- projectUserText,type UserTextReferences  @packages/client/ui-primitives/src/index.ts
- RenderMessageImages  @packages/client/ui-conversation/src/client/contract/slots.ts
- TURN_PROCESS_INDEPENDENT_KINDS  @packages/client/ui-chat/src/client/contract/turn-process.ts
- UserTextReferences  @packages/client/ui-primitives/src/user-text.tsx

### packages/llm (1)
- deepSeekConfigFields,Config,plainOptions,resolveAdapterOptions,PUBLIC_BASE_URL  @packages/llm/llm-deepseek/src/index.ts

### packages/typert (1)
- WorkspaceTypertGenerator  @packages/typert/generator/src/index.ts

### [reshaped candidates] both removed & re-added in-window (43)
- apps::desktopUpdateMetadataFilename
- apps::loadDesktopPackageEnvironment
- packages/api::rejectRemoteStreamUpgrade
- packages/boot::writePluginEnabled
- packages/client::AccountAvatar
- packages/client::AccountSection
- packages/client::AssistantMarkdownProps
- packages/client::COLLAPSE_TIMINGS
- packages/client::CollapseTiming
- packages/client::DesktopOnboardingEntry
- packages/client::KeyedStandardSource
- packages/client::MessageImageLabels
- packages/client::MessageImages
- packages/client::MessageImagesProps
- packages/client::PendingSteeringBubble
- packages/client::PendingSubmissionBubble
- packages/client::QueueDock
- packages/client::RowActionToast
- packages/client::StartSessionOptions
- packages/client::clientLibrary
- packages/client::createFlowMotion
- packages/client::imageCardModel
- packages/client::inject
- packages/client::renderReasoningSlot
- packages/client::staticLinked
- packages/core::createRunCodeTool
- packages/llm::Config
- packages/llm::server
- packages/ptc-runtime::Config
- packages/ptc-runtime::bootstrapArgs
- packages/ptc-runtime::captureStreamWrites
- packages/ptc-runtime::makeConsoleShim
- packages/subagent::Config
- packages/subagent::apply
- packages/test-support::SnapshotProfile
- packages/typert::InvocationModel
- packages/typert::Remote
- packages/typert::RemoteMethodOptions
- packages/typert::RemoteScope
- packages/typert::TypeNodeModel
- packages/typert::TypertCodec
- packages/util::writeFileAtomic
- packages/workflow::mountPtcRuntime

---

## 勘误（2026-10-17，MAIN tag 全仓 grep 复核）

本报告的 removed-gaps 判定对**多成员 `export { A, B } from` 单行**存在解析缺陷（成员串并入一个 key，与单符号删除行对不上），导致同包搬家类变动误报为删除。逐符号全仓复核结果：

| 符号 | a.2 命中 | a.3 命中 | 裁定 |
|---|---|---|---|
| `projectUserText` | 11 | **0** | 删除成立 |
| `RenderMessageImages` | 9 | **0** | 删除成立 |
| `OperatorPeer` | 6 | **0** | 删除成立 |
| `TURN_PROCESS_INDEPENDENT_KINDS` | 5 | **0** | 删除成立 |
| `TerminalAttachmentId` | 7 | **0** | 删除成立 |
| `WorkspaceTypertGenerator` | 8 | **12** | ⚠ **误报**：实现移 `src/workspace.ts`，index 仍再导出，无断裂 |

同理，a.1→a.2 段的 `packages/sdk::DeepSeekHarness,HarnessSession`（多成员行）与 a.2→a.3 的 `llm-deepseek` config 组均为同一解析缺陷的假阳；已在正文文档修正。