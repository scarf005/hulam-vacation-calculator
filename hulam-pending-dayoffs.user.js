// ==UserScript==
// @name        실제 잔여 휴가일 계산기
// @description 승인대기를 감안한 실제 잔여 휴가일을 계산합니다.
// @namespace   scarf
// @match       https://www.hulam.co.kr/hulam/p_holiday_applicaiton_list.php*
// @match       https://www.hulam.co.kr/hulam/p_annual_master.php*
// @grant       none
// @version     0.0.0
// @author      scarf
// ==/UserScript==

const DAYOFF_KEY = "total-pending-dayoffs"

const main = () => {
  const pendings = Array.from(document.querySelectorAll("tbody tr"))
    .filter(el => el.querySelector("td:nth-of-type(4)")?.innerText === "승인대기")
    .map(el => el.querySelector("td:nth-of-type(3)")?.innerText.replace("일", ""))

  if (pendings.length) {
    const days = pendings.reduce((a, b) => +a + +b)
    localStorage.setItem(DAYOFF_KEY, days)
  } else {
    const days = +(localStorage.getItem(DAYOFF_KEY) ?? '0')

    const remainingDaysParentSpan = document.querySelector('td.point_cell:nth-of-type(6) > span > span[style*="color: var(--primary-blue-500-maincolor)"]')
    if (!remainingDaysParentSpan) return

    const currentRemainingDays = parseFloat(remainingDaysParentSpan.innerText.replace("일", "").trim())
    const displayOnSpan = remainingDaysParentSpan.querySelector('span.display_on')

    if (!displayOnSpan) return
    const actualRemainingDays = (currentRemainingDays - days).toFixed(3)
    displayOnSpan.innerText = `\n- ${days}일 = ${actualRemainingDays}일`
  }
}

main()
