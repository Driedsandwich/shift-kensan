import {
  sheetSchema,
  settingsSchema,
  type Sheet,
  type Settings,
} from "./schema";
import { minimumAt, SUPPORTED_FROM, SUPPORTED_TO } from "../data/minimum-wages";
import { dayNumber, dayString, interval, asTime, weekKey } from "./time";
export type EvidenceRow = {
  date: string;
  start: string;
  end: string;
  minutes: number;
  minimum: number;
  baseRate: number;
  overtimeRate: number;
  nightRate: number;
  holidayRate: number;
  base: number;
  premium: number;
  amount: number;
  rule: string;
};
export type DayResult = {
  date: string;
  minutes: number;
  outsideMinutes: number;
  breakMinutes: number;
  requiredBreak: number;
  nightMinutes: number;
  overtimeMinutes: number;
  holidayMinutes: number;
  base: number;
  premium: number;
  minimumBase: number;
  contractBase: number | null;
  minimumGap: number | null;
  expected: number;
  paid: number | null;
  gap: number | null;
  contract: number | null;
  evidence: EvidenceRow[];
  warnings: string[];
};
export type MonthResult = {
  month: string;
  minutes: number;
  expected: number;
  paid: number | null;
  gap: number | null;
  contract: number | null;
};
export type Calculation = {
  days: DayResult[];
  months: MonthResult[];
  minutes: number;
  expected: number;
  paid: number | null;
  gap: number | null;
  warnings: string[];
  assumptions: string[];
};
export function roundYen(n: number, mode: Settings["rounding"]) {
  const clean = Math.round(n * 1e8) / 1e8;
  return mode === "ceil"
    ? Math.ceil(clean)
    : mode === "round"
      ? Math.round(clean)
      : clean;
}
export function requiredBreak(minutes: number) {
  return minutes > 480 ? 60 : minutes > 360 ? 45 : 0;
}
export function calculate(raw: Sheet, options: Settings): Calculation {
  const sheet = sheetSchema.parse(raw),
    settings = settingsSchema.parse(options);
  if (!sheet.shifts.length) throw new Error("勤務日を追加してください。");
  if (sheet.payType === "hourly" && sheet.rate === null)
    throw new Error("時給を入力してください。");
  if (
    sheet.payType === "class" &&
    settings.classBasis === "lesson" &&
    (!sheet.classMinutes || !sheet.rate)
  )
    throw new Error("コマ単価とコマの長さを入力してください。");
  const seen = new Set<number>(),
    daily = new Map<number, number>(),
    weekly = new Map<number, number>(),
    overtimeByMonth = new Map<string, number>();
  const warnings = new Set<string>();
  const days: DayResult[] = [];
  const shifts = [...sheet.shifts].sort((a, b) =>
    (a.date ?? "").localeCompare(b.date ?? ""),
  );
  const dateSet = new Set<string>();
  for (const shift of shifts) {
    if (!shift.date)
      throw new Error("勤務日が読み取れません。日付を入力してください。");
    const date = shift.date,
      day = dayNumber(date),
      month = date.slice(0, 7);
    if (dateSet.has(date))
      throw new Error(
        `${date}: 同じ日の勤務はひとつのカードにまとめてください。`,
      );
    dateSet.add(date);
    if (date < SUPPORTED_FROM || date > SUPPORTED_TO)
      throw new Error(
        `確認済み期間は ${SUPPORTED_FROM}〜${SUPPORTED_TO} です。`,
      );
    const work = new Map<number, boolean>(),
      rest = new Set<number>();
    for (const block of shift.blocks) {
      if (block.instructed === "no" && block.kind !== "休憩") continue;
      if (block.instructed === "unknown" && block.kind !== "休憩") {
        warnings.add(
          "指示が不明な作業があります。指示・義務・待機の実態を確認してください。",
        );
        if (!settings.includeUnknown) continue;
      }
      if (!block.start || !block.end)
        throw new Error(
          `${date}: ${block.kind}の開始・終了を入力してください。`,
        );
      const [a, b] = interval(block.start, block.end);
      if (b <= a || b - a > 1440 || b > 2880)
        throw new Error(
          `${date}: 時刻の範囲を確認してください。同じ時刻を24時間勤務とはみなしません。`,
        );
      for (let m = a; m < b; m++) {
        if (block.kind === "休憩") rest.add(m);
        else
          work.set(
            m,
            (work.get(m) ?? false) || !["授業", "勤務"].includes(block.kind),
          );
      }
    }
    const all = [...work.keys()].sort((a, b) => a - b);
    if (!all.length) throw new Error(`${date}: 検算に含める勤務がありません。`);
    if (all[0] >= 1440 || all.at(-1)! - all[0] >= 1440)
      throw new Error(`${date}: 始業は当日、全体は24時間以内にしてください。`);
    for (const m of rest) {
      if (m <= all[0] || m >= all.at(-1)!)
        throw new Error(`${date}: 休憩は勤務の途中の時刻を入力してください。`);
      work.delete(m);
    }
    const minutes = [...work.keys()].sort((a, b) => a - b);
    if (!minutes.length) throw new Error(`${date}: 実働時間がありません。`);
    const d: DayResult = {
      date,
      minutes: minutes.length,
      outsideMinutes: [...work.values()].filter(Boolean).length,
      breakMinutes: rest.size,
      requiredBreak: requiredBreak(minutes.length),
      nightMinutes: 0,
      overtimeMinutes: 0,
      holidayMinutes: 0,
      base: 0,
      premium: 0,
      minimumBase: 0,
      contractBase: null,
      minimumGap: null,
      expected: 0,
      paid: shift.paid,
      gap: null,
      contract:
        sheet.payType === "class" &&
        sheet.rate !== null &&
        shift.classes !== null
          ? sheet.rate * shift.classes
          : null,
      evidence: [],
      warnings: [],
    };
    if (d.breakMinutes < d.requiredBreak)
      d.warnings.push(
        `休憩は${d.requiredBreak}分が目安ですが、記録は${d.breakMinutes}分です（労基法34条）。`,
      );
    if (shift.uncertain.length) d.warnings.push(...shift.uncertain);
    let last: EvidenceRow | undefined;
    for (const m of minutes) {
      const abs = day * 1440 + m;
      if (seen.has(abs))
        throw new Error(
          "勤務カード間で時刻が重なっています。二重計上を避けるため修正してください。",
        );
      seen.add(abs);
      const actualDay = day + Math.floor(m / 1440),
        actualDate = dayString(actualDay),
        clock = m % 1440;
      const minimum = minimumAt(sheet.prefecture, actualDate).applied;
      const baseRate =
        sheet.payType === "hourly"
          ? Math.max(minimum, sheet.rate!)
          : settings.classBasis === "lesson"
            ? Math.max(minimum, (sheet.rate! * 60) / sheet.classMinutes!)
            : minimum;
      const holiday = settings.holidayDates.includes(actualDate);
      const night = clock >= 1320 || clock < 300;
      const dayCount = daily.get(day) ?? 0,
        wk = weekKey(day, settings.weekStart),
        weekCount = weekly.get(wk) ?? 0;
      const dailyOT = !holiday && dayCount >= 480;
      const ot = !holiday && (dailyOT || weekCount >= 2400);
      if (!holiday) {
        daily.set(day, dayCount + 1);
        if (!dailyOT) weekly.set(wk, weekCount + 1);
      }
      const otSoFar = overtimeByMonth.get(month) ?? 0;
      const overtimeRate = ot ? (otSoFar >= 3600 ? 50 : 25) : 0;
      if (ot) overtimeByMonth.set(month, otSoFar + 1);
      const nightRate = night ? 25 : 0,
        holidayRate = holiday ? 35 : 0;
      d.nightMinutes += Number(night);
      d.overtimeMinutes += Number(ot);
      d.holidayMinutes += Number(holiday);
      const rule =
        `最低賃金 ${minimum}円／時・通常分100%` +
        (overtimeRate ? ` + 時間外${overtimeRate}%` : "") +
        (nightRate ? " + 深夜25%" : "") +
        (holidayRate ? " + 法定休日35%" : "");
      if (
        last &&
        last.date === actualDate &&
        last.end === asTime(m) &&
        last.baseRate === baseRate &&
        last.overtimeRate === overtimeRate &&
        last.nightRate === nightRate &&
        last.holidayRate === holidayRate &&
        last.minimum === minimum
      ) {
        last.minutes++;
        last.end = asTime(m + 1);
      } else {
        last = {
          date: actualDate,
          start: asTime(m),
          end: asTime(m + 1),
          minutes: 1,
          minimum,
          baseRate,
          overtimeRate,
          nightRate,
          holidayRate,
          base: 0,
          premium: 0,
          amount: 0,
          rule,
        };
        d.evidence.push(last);
      }
    }
    for (const e of d.evidence) {
      e.base = (e.baseRate * e.minutes) / 60;
      e.premium =
        (e.base * (e.overtimeRate + e.nightRate + e.holidayRate)) / 100;
      e.amount = e.base + e.premium;
      d.base += e.base;
      d.premium += e.premium;
      d.minimumBase += (e.minimum * e.minutes) / 60;
    }
    d.contractBase =
      sheet.payType === "hourly" ? (sheet.rate! * d.minutes) / 60 : d.contract;
    d.minimumGap =
      d.contractBase === null
        ? null
        : Math.max(0, d.minimumBase - d.contractBase);
    if (d.minimumGap !== null && d.minimumGap > 0)
      d.warnings.push(
        "契約額をこの実働時間で比べると最低賃金の通常分に届かない試算です。対象となる手当と実際の通常賃金を確認してください。",
      );
    d.expected = d.base + d.premium;
    d.gap = d.paid === null ? null : Math.max(0, d.expected - d.paid);
    days.push(d);
  }
  if (!settings.completePeriod)
    warnings.add(
      "入力した勤務だけの試算です。同じ週・賃金計算月の勤務が欠けると、時間外・月60時間超を少なく見積もります。",
    );
  if (sheet.payType === "class")
    warnings.add(
      settings.classBasis === "floor"
        ? "コマ給は地域別最低賃金を基礎にした下限の参考試算です。契約単価による授業外賃金・出来高払の割増基礎は別途確認が必要です。"
        : "コマ単価÷授業時間の時給を全作業に適用する仮定です。契約上の根拠を確認してください。",
    );
  warnings.add(
    "最低賃金の比較は契約の通常賃金を基礎にした参考です。支払額に含まれる通常分・割増分を分離していないため、総支払額だけで最低賃金の充足は判断しません。",
  );
  warnings.add(
    "支払額は、対象期間が同じ税・保険の控除前の賃金（通常分と割増）です。交通費・賞与等と手取り額を混ぜないでください。",
  );
  const months: MonthResult[] = [];
  for (const month of [...new Set(days.map((d) => d.date.slice(0, 7)))]) {
    const ds = days.filter((d) => d.date.startsWith(month));
    const overrides = sheet.monthlyPaid.filter((p) => p.month === month);
    if (overrides.length > 1) throw new Error("月の支払額が重複しています。");
    const paid =
      overrides[0]?.amount ??
      (ds.some((d) => d.paid === null)
        ? null
        : ds.reduce((a, d) => a + d.paid!, 0));
    const expected = roundYen(
      ds.reduce((a, d) => a + d.expected, 0),
      settings.rounding,
    );
    months.push({
      month,
      minutes: ds.reduce((a, d) => a + d.minutes, 0),
      expected,
      paid,
      gap: paid === null ? null : Math.max(0, expected - paid),
      contract: ds.every((d) => d.contract !== null)
        ? ds.reduce((a, d) => a + d.contract!, 0)
        : null,
    });
  }
  for (const p of sheet.monthlyPaid)
    if (!months.some((m) => m.month === p.month))
      throw new Error(`${p.month}: 月の支払額に対応する勤務がありません。`);
  const paid = months.some((m) => m.paid === null)
    ? null
    : months.reduce((a, m) => a + m.paid!, 0);
  return {
    days,
    months,
    minutes: days.reduce((a, d) => a + d.minutes, 0),
    expected: months.reduce((a, m) => a + m.expected, 0),
    paid,
    gap: paid === null ? null : months.reduce((a, m) => a + m.gap!, 0),
    warnings: [...warnings],
    assumptions: [
      "労働時間は1分単位。途中で切り捨てず、日別は端数を保持し、月別合計だけ指定の円未満処理をします。",
      `円未満の処理（仮の前提）: ${settings.rounding === "ceil" ? "月の合計で切り上げ" : settings.rounding === "round" ? "月の合計で四捨五入" : "丸めない（画面は小数2桁）"}。通達上の全ての端数処理方式は再現しません。`,
      `週の始まりは${"日月火水木金土"[settings.weekStart]}曜日。変形労働時間制・週44時間特例等を適用しない、原則の1日8時間・週40時間です。`,
      "継続する日またぎ勤務は始業日の1勤務。週・月の集計も始業日に帰属。最低賃金と法定休日・深夜の判定は実際の暦日時刻で切り替えます。",
      "賃金計算月は毎月1日〜末日。1か月60時間超の時間外は50%。法定休日の時間は時間外と重ねません。",
      `法定休日は入力された日付だけです。日曜・祝日を自動で法定休日にしません。指示不明の作業は${settings.includeUnknown ? "含める" : "除く"}仮定です。`,
      "休憩は労働から離れたと本人が確認した区間だけを除きます。空白時間を勝手に休憩として補いません。",
      "月別支払額があれば日別支払額に優先。同じ月の過不足は相殺、違う月の過払いは他月の不足と相殺しません。日別差額の合計とは一致しない場合があります。",
    ],
  };
}
