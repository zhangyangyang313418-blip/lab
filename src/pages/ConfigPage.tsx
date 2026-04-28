import { AppLayout } from "../components/layout/AppLayout";
import { ConfigSummary } from "../components/config/ConfigSummary";
import { ImportPanel } from "../components/config/ImportPanel";
import { useAppState } from "../store/appState";

export function ConfigPage() {
  const { state } = useAppState();

  return (
    <AppLayout
      title="配置页"
      subtitle="查看当前种子配置，并通过本地文件名快速识别导入的工作簿种类。"
    >
      <div className="content-stack">
        <section className="panel hero-card">
          <p className="section-label">配置</p>
          <h2>轻量级配置管理</h2>
          <p className="hero-card__copy">
            这个页面只负责呈现当前种子配置和本地文件选择提示，后续再接入真正的导入流程。
          </p>
        </section>
        <ConfigSummary state={state} />
        <ImportPanel />
      </div>
    </AppLayout>
  );
}
