// @ts-check
// ==UserScript==
// @name        휴가 사용일 계산기
// @description 신청 내역을 종류(연차/특별휴가/보상휴가 등)별로 구분해 올해 사용한 일수를 자동으로 계산해 표시합니다.
// @namespace   scarf
// @match       https://www.hulam.co.kr/hulam/p_holiday_applicaiton_list.php*
// @match       https://www.hulam.co.kr/hulam/p_annual_master.php*
// @homepageURL https://gist.github.com/scarf005/2b0dad03d4802ad2e2bd572f8c073e39
// @supportURL  https://gist.github.com/scarf005/2b0dad03d4802ad2e2bd572f8c073e39
// @downloadURL https://gist.github.com/scarf005/2b0dad03d4802ad2e2bd572f8c073e39/raw/hulam-pending-dayoffs.user.js
// @grant       none
// @version     2.1.0
// @author      scarf
// ==/UserScript==

const USAGE_KEY = "vacation-usage"

/**
 * 실제 차감으로 이어지는(승인대기/승인완료) 상태 목록.
 * 반려·취소된 신청은 사용으로 치지 않으므로 제외합니다.
 */
const CONSUMING_STATUSES = new Set(["승인대기", "승인완료"])

/** 연차 계열(반차/반반차/시간단위 등)로 판단할 구분 문구 */
const ANNUAL_KIND_PATTERN = /연차|반차|반반차/

/** 행 액션 버튼에서 신청 유형(hapl_02)을 추출: '1' = 연차휴가신청 */
const haplTypeRegex = /Open(?:Add|View)Form\('(\d+)'/

/**
 * 구분 셀에서 라벨 span(`일반` 등)을 제외한 기본 종류 텍스트만 뽑습니다.
 * @param {Element} kindCell
 * @returns {string} e.g. '연차', '특별휴가', '보상휴가'
 */
const baseKind = (kindCell) => {
  const clone = /** @type {Element} */ (kindCell.cloneNode(true))
  clone.querySelectorAll("*").forEach((child) => child.remove())
  return (clone.textContent || "").trim()
}

/**
 * 휴가 행을 종류(카테고리)로 분류합니다.
 * 연차휴가신청(hapl_02='1')이거나 연차 계열 문구면 `연차`로 통합하고,
 * 그 외(특별휴가/보상휴가 등)는 기본 종류 텍스트를 그대로 카테고리로 씁니다.
 * @param {HTMLTableRowElement} rowEl
 * @param {Element} kindCell
 * @returns {string}
 */
const categorize = (rowEl, kindCell) => {
  const base = baseKind(kindCell)
  const haplType = rowEl.innerHTML.match(haplTypeRegex)?.[1]
  if (haplType === "1" || ANNUAL_KIND_PATTERN.test(base)) return "연차"
  return base || "기타"
}

// =============================================================================
// 데이터 파싱 및 Fetch 로직
// =============================================================================

/**
 * @typedef {object} Holiday
 * @property {string} date - 휴가 날짜 (e.g., '2026-07-21')
 * @property {number} year - 휴가 연도 (날짜 셀 앞 4자리)
 * @property {string} category - 휴가 종류 (연차 / 특별휴가 / 보상휴가 등)
 * @property {number} day - 휴가 일수 (e.g., 1, 0.5, 0.25)
 * @property {string} status - 휴가 상태 (e.g., '승인대기')
 */

const dayRegex = /(?<day>\d+(?:\.\d+)?)/

/**
 * HTML 테이블 행(tr) 엘리먼트에서 휴가 정보를 파싱합니다.
 * @param {HTMLTableRowElement} rowEl - 파싱할 <tr> 엘리먼트
 * @returns {Holiday | null} 파싱된 휴가 객체. 유효하지 않은 행일 경우 null을 반환합니다.
 */
const parseHolidayFromRow = (rowEl) => {
  const cells = rowEl.querySelectorAll("td")
  if (cells.length < 4) return null

  const [dateCell, kindCell, dayCell, statusCell] = cells

  const date = (dateCell.textContent || "").trim()
  const year = parseInt(date.slice(0, 4), 10)
  if (isNaN(year)) return null

  const dayText = dayCell.textContent || ""
  const day = parseFloat(dayText.match(dayRegex)?.groups?.day ?? "0")

  return {
    date,
    year,
    category: categorize(rowEl, kindCell),
    day,
    status: (statusCell.textContent || "").trim(),
  }
}

/**
 * 모든 페이지의 휴가 신청 내역을 가져와 하나의 배열로 반환합니다.
 * @param {string} [baseUrl='/hulam/p_holiday_applicaiton_list.php'] - 휴가 신청 목록 페이지의 기본 URL
 * @returns {Promise<Holiday[]>} 모든 휴가 신청 내역 객체 배열
 */
const fetchAllHolidayApplications = async (
  baseUrl = "/hulam/p_holiday_applicaiton_list.php",
) => {
  const firstPageParams = new URLSearchParams({
    toYear: "",
    toMonth: "",
    page: "1",
  })
  const firstPageUrl = `${baseUrl}?${firstPageParams.toString()}`
  const firstPageHtml = await fetch(firstPageUrl).then((res) => res.text())
  const doc = new DOMParser().parseFromString(firstPageHtml, "text/html")

  const pageLinks = [...doc.querySelectorAll(".pagination a span")]
  const pageNumbers = pageLinks
    .map((span) => parseInt(span.textContent || "", 10))
    .filter((num) => !isNaN(num))
  const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1

  const allPageUrls = Array.from(
    { length: maxPage - 1 },
    (_, i) =>
      `${baseUrl}?${new URLSearchParams({
        toYear: "",
        toMonth: "",
        page: `${i + 2}`,
      })}`,
  )

  const allPagePromises = allPageUrls.map((url) =>
    fetch(url).then((res) => res.text())
  )
  const allHtmlContents = await Promise.all(allPagePromises)

  return [firstPageHtml, ...allHtmlContents].flatMap((html) => {
    const pageDoc = new DOMParser().parseFromString(html, "text/html")
    const rows = /** @type {HTMLTableRowElement[]} */ ([
      ...pageDoc.querySelectorAll(".table.cell_table tbody tr"),
    ])
    return rows.flatMap((row) => parseHolidayFromRow(row) || [])
  })
}

// =============================================================================
// 집계 로직
// =============================================================================

/**
 * @typedef {Record<string, number>} Usage - 종류별 사용 일수
 */

/**
 * 해당 연도의 실제 사용(승인대기 + 승인완료) 휴가만 골라 최신순으로 정렬합니다.
 * @param {Holiday[]} holidays
 * @param {number} year - 집계할 연도
 * @returns {Holiday[]}
 */
const collectUsage = (holidays, year) =>
  holidays
    .filter((h) => h.year === year && CONSUMING_STATUSES.has(h.status))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

/**
 * 사용 내역을 종류별 합계로 집계합니다.
 * @param {Holiday[]} holidays
 * @returns {Usage}
 */
const totalsByCategory = (holidays) => {
  /** @type {Usage} */
  const usage = {}
  for (const holiday of holidays) {
    usage[holiday.category] = (usage[holiday.category] ?? 0) + holiday.day
  }
  return usage
}

// =============================================================================
// 저장/조회 로직
// =============================================================================

/**
 * 캐시된 사용 내역(상세 목록)을 읽어옵니다.
 * @returns {Holiday[] | null}
 */
const getUsage = () => {
  const raw = localStorage.getItem(USAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** @param {Holiday[]} holidays */
const saveUsage = (holidays) =>
  localStorage.setItem(USAGE_KEY, JSON.stringify(holidays))

/** 소수점 오차를 다듬어 표시용 숫자로 변환합니다. */
const fmt = (/** @type {number} */ n) => parseFloat(n.toFixed(4))

// =============================================================================
// UI 표시 로직
// =============================================================================

const DISPLAY_ID = "vacation-usage-display"
const TOOLTIP_ID = "vacation-usage-tooltip"

/** 집계 대상 연도 (올해) */
const targetYear = new Date().getFullYear()

/** 호버 시 표시할 상세 내역 툴팁(싱글턴)을 가져옵니다. */
const getTooltip = () => {
  let tip = document.getElementById(TOOLTIP_ID)
  if (tip) return tip

  tip = document.createElement("div")
  tip.id = TOOLTIP_ID
  Object.assign(tip.style, {
    position: "fixed",
    zIndex: "10000",
    display: "none",
    maxHeight: "70vh",
    overflowY: "auto",
    padding: "10px 12px",
    background: "#2b2b2b",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "normal",
    lineHeight: "1.5",
    borderRadius: "8px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
  })
  document.body.append(tip)
  return tip
}

/**
 * 상세 내역(언제·며칠 썼는지)을 툴팁 안에 종류별로 그려 넣습니다.
 * @param {HTMLElement} tip
 * @param {Holiday[]} holidays - 최신순 정렬된 올해 사용 내역
 */
const fillTooltip = (tip, holidays) => {
  tip.textContent = ""

  const totals = totalsByCategory(holidays)
  const categories = Object.keys(totals).sort((a, b) => totals[b] - totals[a])

  for (const category of categories) {
    const header = document.createElement("div")
    header.textContent = `${category} — 합계 ${fmt(totals[category])}일`
    Object.assign(header.style, {
      fontWeight: "bold",
      margin: "8px 0 4px",
      paddingBottom: "2px",
      borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
    })
    if (category === categories[0]) header.style.marginTop = "0"
    tip.append(header)

    for (const holiday of holidays.filter((h) => h.category === category)) {
      const row = document.createElement("div")
      const status = holiday.status === "승인대기" ? " (대기)" : ""
      row.textContent = `${holiday.date}  ${fmt(holiday.day)}일${status}`
      row.style.whiteSpace = "nowrap"
      tip.append(row)
    }
  }
}

/**
 * 사용 일수를 화면에 표시하고, 호버 시 상세 내역 툴팁을 연결합니다.
 * @param {Holiday[] | null} holidays - 올해 사용 내역 (없으면 null)
 * @param {boolean} [loading] - 계산 중 여부
 */
const render = (holidays, loading = false) => {
  const targetArea = document.querySelector(".row_tit")
  if (!targetArea) return

  const el = /** @type {HTMLElement} */ (
    document.getElementById(DISPLAY_ID) ?? document.createElement("span")
  )
  el.id = DISPLAY_ID
  Object.assign(el.style, {
    marginLeft: "12px",
    fontWeight: "bold",
    color: "#e74c3c",
    cursor: holidays && holidays.length > 0 ? "help" : "default",
    textDecoration: holidays && holidays.length > 0
      ? "underline dotted"
      : "none",
  })

  const totals = holidays ? totalsByCategory(holidays) : {}
  const entries = Object.entries(totals)
  const body = entries.length > 0
    ? entries.map(([category, day]) => `${category} ${fmt(day)}일`).join(" · ")
    : "사용 내역 없음"
  const text = `${targetYear}년 사용: ${body}`
  el.textContent = loading ? `${text} (갱신 중…)` : text

  if (!el.isConnected) targetArea.append(el)

  // 호버 시 상세 내역 툴팁 연결
  let hideTimer = 0
  const showTooltip = () => {
    if (!holidays || holidays.length === 0) return
    clearTimeout(hideTimer)
    const tip = getTooltip()
    fillTooltip(tip, holidays)
    const rect = el.getBoundingClientRect()
    tip.style.left = `${rect.left}px`
    tip.style.top = `${rect.bottom + 6}px`
    tip.style.display = "block"
  }
  const hideTooltip = () => {
    hideTimer = setTimeout(() => {
      getTooltip().style.display = "none"
    }, 150)
  }
  el.onmouseenter = showTooltip
  el.onmouseleave = hideTooltip
  const tip = getTooltip()
  tip.onmouseenter = () => clearTimeout(hideTimer)
  tip.onmouseleave = hideTooltip
}

/**
 * 신청 내역을 받아 올해 사용 내역을 계산하고 표시/저장합니다.
 * 캐시된 값을 먼저 그리고, 백그라운드에서 최신 값으로 갱신합니다.
 */
const calculateUsage = async () => {
  render(getUsage(), true)

  try {
    const usage = collectUsage(await fetchAllHolidayApplications(), targetYear)
    saveUsage(usage)
    render(usage)
  } catch (error) {
    console.error("휴가 사용일 계산 중 오류 발생:", error)
    render(getUsage())
  }
}

/** 휴가사용대장 사용 종료일을 기본값으로 표시 */
const switchToDueDateView = () => {
  const url = "https://www.hulam.co.kr/hulam/p_annual_master.php"
  const tab = document.querySelector(`li.page_tab_list a[href="${url}"]`)
  if (!tab) return
  tab.href = `${url}?today=${new Date().getFullYear()}-12-31`
}

const run = () => {
  switchToDueDateView()

  // 신청 목록 페이지에서만 전체 페이지를 가져와 자동 계산
  if (
    globalThis.location.pathname.includes(
      "/hulam/p_holiday_applicaiton_list.php",
    )
  ) {
    calculateUsage()
  }
}

run()
