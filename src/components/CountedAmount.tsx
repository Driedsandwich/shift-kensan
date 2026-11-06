import { useEffect, useState } from "react";
import { formatMoney } from "../core/message";
import { motionPreference } from "../motion";

// Presentation only. Calculations, exports and the accessible text use the final value.
export function CountedAmount({ value }: { value: number | null }) {
  const [display, setDisplay] = useState(() =>
    motionPreference().matches ? value : 0,
  );
  useEffect(() => {
    const preference = motionPreference();
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      setDisplay(value);
    };
    const onPreferenceChange = () => {
      if (preference.matches) finish();
    };
    if (preference.matches || value === null || value === 0) {
      finish();
      return;
    }
    setDisplay(0);
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min((now - start) / 600, 1);
      setDisplay(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [value]);

  const finalText = value === null ? "未計算" : formatMoney(value);
  return (
    <>
      <strong
        data-testid="gap"
        className={finalText.length > 7 ? "long-amount" : ""}
        aria-hidden="true"
      >
        <span className="counted-value" data-final={finalText}>
          <span>
            {value === null ? "未計算" : formatMoney(display ?? value)}
          </span>
        </span>
        {value !== null && <small> 円</small>}
      </strong>
      <span className="sr-only">
        {finalText}
        {value !== null && " 円"}
      </span>
    </>
  );
}
