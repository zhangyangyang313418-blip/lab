import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../store/appState";
import type { OemCode, PlatformCode, ProjectType, SteeringSide } from "../../types/project";

const oemOptions: Array<{ value: OemCode; label: string }> = [{ value: "JLR", label: "JLR" }];
const projectTypeOptions: Array<{ value: ProjectType; label: string }> = [
  { value: "new_project", label: "新项目" },
  { value: "change_project", label: "变更项目" },
];
const platformOptions: Array<{ value: PlatformCode; label: string }> = [
  { value: "EMA", label: "EMA" },
  { value: "MLA", label: "MLA" },
];
const steeringOptions: Array<{ value: SteeringSide; label: string }> = [
  { value: "LHD", label: "LHD" },
  { value: "RHD", label: "RHD" },
];

export function ProjectSetupForm() {
  const { state, dispatch } = useAppState();
  const navigate = useNavigate();
  const [oem, setOem] = useState(state.projectSetup.oem);
  const [projectType, setProjectType] = useState(state.projectSetup.projectType);
  const [platform, setPlatform] = useState(state.projectSetup.platform);
  const [steeringSides, setSteeringSides] = useState<SteeringSide[]>(
    state.projectSetup.steeringSides.length > 0 ? state.projectSetup.steeringSides : ["LHD"],
  );
  const [projectCode, setProjectCode] = useState(state.projectSetup.projectCode);
  const [isFullyReused, setIsFullyReused] = useState(state.projectSetup.isFullyReused);
  const [steeringError, setSteeringError] = useState("");

  function toggleSteeringSide(side: SteeringSide) {
    setSteeringError("");
    setSteeringSides((currentSides) =>
      currentSides.includes(side)
        ? currentSides.filter((currentSide) => currentSide !== side)
        : [...currentSides, side],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (steeringSides.length === 0) {
      setSteeringError("请至少选择一个驾驶方向配置。");
      return;
    }

    dispatch({
      type: "applyProjectSetup",
      updates: {
        oem,
        projectType,
        platform,
        steeringSides,
        projectCode,
        isFullyReused,
        reuseEnvironmentTemplate: isFullyReused,
        reuseMaterialTemplate: isFullyReused,
        reuseEmcTemplate: isFullyReused,
        selectedChangeIds: [],
        description: "",
      },
    });
    navigate("/input");
  }

  return (
    <form className="panel form-card" onSubmit={handleSubmit}>
      <div className="field-grid">
        <fieldset className="field-group">
          <legend>OEM</legend>
          <div className="choice-row">
            {oemOptions.map((option) => (
              <label key={option.value} className="choice-pill">
                <input
                  type="radio"
                  name="oem"
                  value={option.value}
                  checked={oem === option.value}
                  onChange={() => setOem(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend>项目类型</legend>
          <div className="choice-row">
            {projectTypeOptions.map((option) => (
              <label key={option.value} className="choice-pill">
                <input
                  type="radio"
                  name="projectType"
                  value={option.value}
                  checked={projectType === option.value}
                  onChange={() => setProjectType(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend>平台</legend>
          <div className="choice-row">
            {platformOptions.map((option) => (
              <label key={option.value} className="choice-pill">
                <input
                  type="radio"
                  name="platform"
                  value={option.value}
                  checked={platform === option.value}
                  onChange={() => setPlatform(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field-group" aria-describedby={steeringError ? "steering-error" : undefined}>
          <legend>驾驶方向</legend>
          <div className="choice-row">
            {steeringOptions.map((option) => (
              <label key={option.value} className="choice-pill">
                <input
                  type="checkbox"
                  name="steeringSides"
                  value={option.value}
                  checked={steeringSides.includes(option.value)}
                  onChange={() => toggleSteeringSide(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {steeringError ? (
            <p id="steering-error" className="helper-text" role="alert" style={{ marginTop: 12 }}>
              {steeringError}
            </p>
          ) : null}
        </fieldset>

        <label className="field">
          <span className="field__label">项目代号</span>
          <input
            aria-label="项目代号"
            className="text-input"
            value={projectCode}
            onChange={(event) => setProjectCode(event.target.value)}
            placeholder="例如 L463"
          />
        </label>
      </div>

      <fieldset className="field-group">
        <legend>是否完全复用</legend>
        <div className="choice-row">
          <label className="choice-pill">
            <input
              type="radio"
              name="isFullyReused"
              checked={isFullyReused}
              onChange={() => setIsFullyReused(true)}
            />
            <span>完全复用</span>
          </label>
          <label className="choice-pill">
            <input
              type="radio"
              name="isFullyReused"
              checked={!isFullyReused}
              onChange={() => setIsFullyReused(false)}
            />
            <span>不完全复用</span>
          </label>
        </div>
        <p className="helper-text" style={{ marginTop: 12 }}>
          完全复用时，系统直接以所选平台基线生成测试结果；不完全复用时，系统先生成基础大纲，并保留人工调整空间。
        </p>
      </fieldset>

      <div className="form-actions">
        <button className="primary-button" type="submit">
          开始评估
        </button>
      </div>
    </form>
  );
}
