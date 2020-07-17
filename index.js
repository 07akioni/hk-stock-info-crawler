const request = require('superagent')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

// url https://di.hkex.com.hk/di/NSForm2.aspx?fn=CS20200709E00619&sa2=an&sid=15841&corpn=China+Jinmao+Holdings+Group+Ltd.&sd=17%2f07%2f2019&ed=17%2f07%2f2020&cid=0&sa1=cl&scsd=17%2f07%2f2019&sced=17%2f07%2f2020&sc=817&src=MAIN&lang=EN&

const baseUrl = 'https://di.hkex.com.hk/di/'

/**
 * @param {string} stockNumber 
 */
async function getStockNoticesLinks (stockNumber) {
  const response = await request
    .get('https://di.hkex.com.hk/di/NSSrchCorpList.aspx')
    .query({
      sa1: 'cl',
      scsd: '17/07/2019',
      sced: '17/07/2020',
      sc: stockNumber,
      src: 'MAIN',
      lang: 'EN'
    })
  const $ = cheerio.load(response.text)
  const listOfAllNoticesLinks = ($('a[href^="NSAllFormList.aspx"]').toArray() || [])
    .map(anchor => baseUrl + anchor.attribs.href)
  return listOfAllNoticesLinks
}

/**
 * @param {string[]} links 
 * @returns {string | null}
 */
async function getHSharesNoticesLink (stockNumber) {
  const links = await getStockNoticesLinks(stockNumber)
  if (!links.length) return null
  if (links.length === 1) return links[0]
  return links.filter(link => ~link.indexOf('H+Shares'))[0] || null
}

/**
 * @param {string} noticesLink 
 */
async function getFormLinks (noticesLink) {
  let page = 1
  let formLinks = []
  while (true) {
    const response = await request.get(noticesLink + `&pg=${page}`)
    const $ = cheerio.load(response.text)
    const anchors = $('td:first-child > a[href^="NSForm"]')
    if (!anchors.length) break
    formLinks = formLinks.concat(anchors.toArray().map(anchor => baseUrl + anchor.attribs.href))
    page += 1
  }
  // console.log(formLinks.length, formLinks)
  return formLinks
}

/**
 * @param {string} formLink 
 */
async function getFormData (formLink) {
  const response = await request.get(formLink)
  const $ = cheerio.load(response.text)
  const data17 = {
    lblDEvtReason: $('span#lblDEvtReason').text(),
    lblDEvtCapBefore: $('span#lblDEvtCapBefore').text(),
    lblDEvtShare: $('span#lblDEvtShare').text(),
    lblDEvtCurrency: $('span#lblDEvtCurrency').text(),
    lblDEvtHPrice: $('span#lblDEvtHPrice').text(),
    lblDEvtAPrice: $('span#lblDEvtAPrice').text(),
    lblDEvtAConsider: $('span#lblDEvtAConsider').text(),
    lblDEvtNatConsider: $('span#lblDEvtNatConsider').text(),
    lblDEvtPosition2: $('span#lblDEvtPosition2').text(),
    lblDEvtReason2: $('span#lblDEvtReason2').text(),
    lblDEvtCapBefore2: $('span#lblDEvtCapBefore2').text(),
    lblDEvtCapAfter2: $('span#lblDEvtCapAfter2').text(),
    lblDEvtShare2: $('span#lblDEvtShare2').text(),
  }
  const data22 = $('#grdCtrlCorp').html()
  const data27 = $('#lblDSuppInfo').text()
  return {
    data17,
    data22,
    data27
  }
/**
  17. Details of relevant event:
    40: span#lblDEvtPosition
    41: span#lblDEvtReason
    42: span#lblDEvtCapBefore
    43: span#lblDEvtCapAfter
    44: span#lblDEvtShare
    45: span#lblDEvtCurrency
    46: span#lblDEvtHPrice
    47: span#lblDEvtAPrice
    48: span#lblDEvtAConsider
    49: span#lblDEvtNatConsider
    50: span#lblDEvtPosition2
    51: span#lblDEvtReason2
    52: span#lblDEvtCapBefore2
    53: span#lblDEvtCapAfter2
    54: span#lblDEvtShare2
  */
/**
  22. Further information in relation to interests of corporations controlled by substantial shareholder
    #grdCtrlCorp
 */
/**
  27. Supplementary information
    #lblDSuppInfo
 */
}

const dataPath = path.resolve(__dirname, 'data')

const stockNumber = '817' // 3968

;(async () => {
  init()
  const noticesLink = await getHSharesNoticesLink(stockNumber)
  if (noticesLink === null) {
    console.log(stockNumber + ' has no corresponding notices link')
    return
  }
  const formLinks = await getFormLinks(noticesLink)
  for (const [index, formLink] of formLinks.entries()) {
    const formData = await getFormData(formLink)
    const formDataLiteral = JSON.stringify(formData, 0, 2)
    fs.writeFileSync(path.resolve(
      dataPath,
      stockNumber + '-' + (index + 1)
    ), formDataLiteral)
  }
})()

function init () {
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath)
  }
}
