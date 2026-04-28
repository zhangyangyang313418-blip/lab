import { AppLayout } from "../components/layout/AppLayout";
import { ProjectSetupForm } from "../components/home/ProjectSetupForm";

export function HomePage() {
  return (
    <AppLayout
      title="HUD 产品测试评估助手"
      subtitle="面向 JLR HUD 项目，先完成基础配置，再生成测试大纲、样本数量与测试时间建议。"
    >
      <div className="content-stack">
        <section className="panel hero-card">
          <p className="section-label">首页</p>
          <h2>创建 HUD 评估项目</h2>
          <p className="hero-card__copy">
            当前首版支持 JLR、EMA/MLA 平台，以及新增项目和变更项目两类评估入口。
          </p>
        </section>
        <ProjectSetupForm />
      </div>
    </AppLayout>
  );
}
