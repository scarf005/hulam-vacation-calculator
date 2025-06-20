// ==UserScript==
// @name        실제 잔여 휴가일 계산기
// @description 모든 페이지의 승인대기 휴가를 계산하고, 실제 잔여 휴가일을 표시합니다.
// @namespace   scarf
// @match       https://www.hulam.co.kr/hulam/p_holiday_applicaiton_list.php*
// @match       https://www.hulam.co.kr/hulam/p_annual_master.php*
// @homepageURL https://gist.github.com/scarf005/2b0dad03d4802ad2e2bd572f8c073e39
// @supportURL  https://gist.github.com/scarf005/2b0dad03d4802ad2e2bd572f8c073e39
// @downloadURL https://gist.github.com/scarf005/2b0dad03d4802ad2e2bd572f8c073e39/raw/hulam-pending-dayoffs.user.js
// @grant       none
// @version     1.0.0
// @author      scarf
// ==/UserScript==

const DAYOFF_KEY = "total-pending-dayoffs"

// =============================================================================
// 데이터 파싱 및 Fetch 로직
// =============================================================================

/**
 * @typedef {object} Holiday
 * @property {Date} date - 휴가 날짜
 * @property {string} kind - 휴가 구분 (e.g., '연차', '반차(오전)')
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

  const dayText = dayCell.textContent || ""
  const day = parseFloat(dayText.match(dayRegex)?.groups?.day ?? "0")

  return {
    date: new Date((dateCell.textContent || "").trim()),
    kind: (kindCell.textContent || "").trim(),
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
  const firstPageParams = new URLSearchParams({ toYear: "", toMonth: "", page: "1" })
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
    (_, i) => `${baseUrl}?${new URLSearchParams({ toYear: "", toMonth: "", page: `${i + 2}` })}`,
  )

  const allPagePromises = allPageUrls.map((url) => fetch(url).then((res) => res.text()))
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
// UI 업데이트 및 이벤트 핸들링 로직
// =============================================================================

const getDays = () => {
  const raw = localStorage.getItem(DAYOFF_KEY)
  return raw ? parseFloat(raw) : null
}

/**
 * localStorage의 값을 읽어 실제 잔여 휴가일을 화면에 표시합니다.
 * (p_annual_master.php 페이지에서만 동작)
 */
const displayActualRemainingDays = () => {
  if (!globalThis.location.pathname.includes("/hulam/p_annual_master.php")) return

  const days = getDays() ?? 0

  const remainingDaysParentSpan = document.querySelector(
    'td.point_cell:nth-of-type(6) > span > span[style*="color: var(--primary-blue-500-maincolor)"]',
  )
  if (!remainingDaysParentSpan) return

  // 자식 span을 제외한 순수 텍스트 값만 추출하기 위한 안정적인 방법
  const clone = remainingDaysParentSpan.cloneNode(true)
  clone.querySelectorAll("*").forEach((child) => child.remove())
  const currentText = (clone.textContent || "").trim()
  const currentRemainingDays = parseFloat(currentText.replace("일", "").trim())
  if (isNaN(currentRemainingDays)) return

  const oldDisplay = remainingDaysParentSpan.querySelector(".actual-dayoff-display")
  if (oldDisplay) oldDisplay.remove()

  if (days > 0) {
    const displayOnSpan = document.createElement("span")
    displayOnSpan.className = "actual-dayoff-display"
    displayOnSpan.style.display = "block"
    displayOnSpan.style.color = "#e74c3c"
    displayOnSpan.style.fontWeight = "bold"

    const actualRemainingDays = (currentRemainingDays - days).toFixed(3)
    displayOnSpan.innerText = `(승인대기 포함: ${actualRemainingDays}일)`

    remainingDaysParentSpan.appendChild(displayOnSpan)
  }
}

/**
 * '승인대기' 휴가일 계산을 트리거하는 핸들러
 * @param {MouseEvent} event - 클릭 이벤트 객체
 */
const handleCalculateClick = async (event) => {
  const button = /** @type {HTMLButtonElement} */ (event.currentTarget)
  button.disabled = true
  button.textContent = "계산 중..."

  try {
    const allHolidays = await fetchAllHolidayApplications()
    const totalPendingDays = allHolidays
      .filter((holiday) => holiday.status === "승인대기")
      .reduce((total, holiday) => total + holiday.day, 0)

    localStorage.setItem(DAYOFF_KEY, totalPendingDays.toString())
    button.textContent = `${totalPendingDays}일`

    displayActualRemainingDays()
  } catch (error) {
    console.error("휴가 내역 계산 중 오류 발생:", error)
    alert("오류가 발생했습니다. 콘솔을 확인해주세요.")
    button.textContent = "계산 실패"
  } finally {
    setTimeout(() => {
      button.disabled = false
    }, 2000)
  }
}

/**
 * 페이지에 계산 버튼을 추가하는 함수
 */
const addCalculateButton = () => {
  const targetArea = document.querySelector(".row_tit")
  if (!targetArea) return

  const calcButton = document.createElement("button")
  calcButton.textContent = `승인대기 휴가 계산 (${getDays() ?? "?"}일)`
  calcButton.type = "button"
  calcButton.className = "btn btn_sm"
  calcButton.style.marginLeft = "10px"

  calcButton.addEventListener("click", handleCalculateClick)
  targetArea.append(calcButton)
}

const run = () => {
  addCalculateButton()
  displayActualRemainingDays()
}

run()
