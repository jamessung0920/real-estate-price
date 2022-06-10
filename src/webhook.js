const fs = require("fs/promises");
const util = require("util");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
// const puppeteer = require("puppeteer");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const randomUseragent = require("random-useragent");

const constants = require("./constants");
const config = require("./config");
const instruction = require("./instruction");

const delay = util.promisify(setTimeout);

puppeteer.use(StealthPlugin());

/** example request body
{
  destination: 'jwioefjiwoefjwioefjewiofjweifoj',
  events: [
    {
      type: 'message',
      message: { type: 'text', id: '15692615108402', text: '左營-台北 2022-03-20 6:00 1張' },
      timestamp: 1646469833446,
      source: { type: 'user', userId: 'jwoiefjwioefhwofewhf' },
      replyToken: 'jiowefjoweifwioefjwioefj',
      mode: 'active',
    },
  ],
}
*/
async function handleLineWebhook({ headers, body: reqBody }, redisClient) {
  console.log(reqBody.events);
  const randomDirName = uuidv4();
  const screenShotDir = `/app/downloads/${randomDirName}`;
  if (Array.isArray(reqBody.events) && reqBody.events.length === 0) return;

  Promise.allSettled(
    reqBody.events.map(async (event) => {
      // event type may be message, follow, unfollow and so on
      if (event.type !== "message" || event.mode !== "active") return;
      if (event.message.type !== "text") return;

      const userInput = event.message.text.trim();
      const { userId } = event.source;
      let messageObjects = [];

      const hasLockOfUser = await redisClient.get(`DOSLock-${userId}`);
      if (hasLockOfUser === "true") {
        messageObjects.push({
          type: "text",
          text: "前次查詢仍在查詢中，請等待查詢結果後再查詢。",
        });
        await replyToUser(event.replyToken, messageObjects);
        return;
      }

      switch (userInput) {
        case constants.RICH_MENU_ACTION.BUYSELL: {
          console.log("買賣查詢");
          await redisClient.set(
            `action-${userId}`,
            constants.RICH_MENU_ACTION.BUYSELL,
            { EX: config.redis.expireTime }
          );
          messageObjects = instruction.getBuysellActionInstruction();
          break;
        }
        case constants.RICH_MENU_ACTION.PRESALE: {
          console.log("預售屋查詢");
          await redisClient.set(
            `action-${userId}`,
            constants.RICH_MENU_ACTION.PRESALE,
            { EX: config.redis.expireTime }
          );
          messageObjects = instruction.getPresaleActionInstruction();
          break;
        }
        default: {
          console.log("查詢結果");
          const userActionCache = await redisClient.get(`action-${userId}`);
          if (!userActionCache) {
            messageObjects.push({
              type: "text",
              text: "請選擇動作，買賣查詢 or 預售屋查詢",
            });
            break;
          }

          const userInputArray = userInput.split(" ");
          if (!hasValidWordCollection(userInputArray)) {
            messageObjects.push({
              type: "text",
              text: "請輸入有效的縣市或鄉鎮市區",
            });
            break;
          }

          const city = changeWord(userInputArray[0]);
          const district = userInputArray[1];
          let buildCaseName = "";
          let address = "";
          if (userActionCache === constants.RICH_MENU_ACTION.PRESALE) {
            buildCaseName = userInputArray[2] ?? "";
          } else {
            address = userInputArray[2] ?? "";
          }

          try {
            await redisClient.set(`DOSLock-${userId}`, true, {
              EX: config.redis.expireTime,
            });
            await visitSite(
              city,
              district,
              address,
              buildCaseName,
              userActionCache,
              screenShotDir
            );
          } catch (error) {
            console.log("=================== error ===================");
            console.log(error);
            messageObjects.push({
              type: "text",
              text: "發生網路問題或非預期錯誤，請重新操作",
            });
            break;
          } finally {
            await redisClient.del(`DOSLock-${userId}`);
          }

          const files = await fs.readdir(screenShotDir);
          const screenShotFiles = files
            .filter((fileName) => fileName.startsWith("scrnsht_"))
            .sort((b, c) => {
              if (b > c) return 1;
              if (c > b) return -1;
              return 0;
            });

          if (screenShotFiles.length === 0) {
            messageObjects.push({
              type: "text",
              text: "無資料",
            });
          }
          for (const file of screenShotFiles) {
            messageObjects.push({
              type: "image",
              originalContentUrl: `https://${headers.host}/static/${randomDirName}/${file}`,
              previewImageUrl: `https://${headers.host}/static/${randomDirName}/${file}`,
            });
          }

          await redisClient.del(`action-${userId}`);
          break;
        }
      }

      await replyToUser(event.replyToken, messageObjects);
    })
  ).catch((err) => console.error(err));
}

async function visitSite(
  city,
  district,
  address,
  buildCaseName,
  action,
  screenShotDir
) {
  console.log("launch browser");
  const browser = await puppeteer.launch({
    // headless: false,
    args: [
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
      `--proxy-server=http://${config.proxy.ip}:3128`,
    ],
    // executablePath: "/opt/homebrew/bin/chromium",
  });
  console.log("launch browser finish");
  const page = (await browser.pages())[0];

  page.on("console", (msg) => console.log(msg.text()));

  const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.79 Safari/537.36";
  const userAgent = randomUseragent.getRandom();
  const UA = userAgent || DEFAULT_USER_AGENT;

  let pageWidth = 395 + Math.floor(Math.random() * 50);
  const pageHeight = 810 + Math.floor(Math.random() * 20);
  console.log(`pageWidth: ${pageWidth}, pageHeight: ${pageHeight}`);
  await page.setViewport({
    width: pageWidth,
    height: pageHeight,
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: false,
    isMobile: false,
  });
  await page.setUserAgent(UA);
  await page.setJavaScriptEnabled(true);
  // set window.navigator.webdriver to undefined (if not use StealthPlugin)
  // await page.evaluateOnNewDocument(() => {
  //   delete navigator.__proto__.webdriver;
  // });
  await page.authenticate({
    username: config.proxy.username,
    password: config.proxy.password,
  });
  console.log("Visit site");
  await retry(
    () => page.goto("https://lvr.land.moi.gov.tw", { timeout: 6000 }),
    3000,
    3
  );
  console.log("Start get data");
  await page.waitForTimeout(200 + Math.floor(Math.random() * 500));

  const elementHandle = await page.waitForSelector("frame");
  const frame = await elementHandle.contentFrame();
  await frame.waitForSelector("#p_city");
  await frame.waitForSelector("#p_town");

  await frame.evaluate(async (city) => {
    const cityDropdownElmt = document.querySelector("#p_city");
    const cityOptions = cityDropdownElmt.querySelectorAll("option");
    const targetCityOption = [...cityOptions].find(
      (option) => option.text === city
    );
    targetCityOption.selected = true;

    // ref: https://github.com/puppeteer/puppeteer/issues/613
    let event = new Event("change", { bubbles: true });
    event.simulated = true;
    cityDropdownElmt.dispatchEvent(event);
  }, city);

  await frame.waitForFunction(
    () => document.querySelector("#p_town").length > 1
  );

  await frame.evaluate(async (district) => {
    const districtDropdownElmt = document.querySelector("#p_town");
    const districtOptions = districtDropdownElmt.querySelectorAll("option");
    const targetDistrictOption = [...districtOptions].find(
      (option) => option.text === district
    );
    targetDistrictOption.selected = true;
  }, district);

  if (action === constants.RICH_MENU_ACTION.PRESALE) {
    await frame.click("a#pills-presale-tab");
    if (buildCaseName) await frame.type("#p_build", buildCaseName);
  }

  await frame.waitForTimeout(200 + Math.floor(Math.random() * 350));
  if (address) {
    await frame.click("a#QryFilter");
    await frame.type("#road", address);
    const filterSearchButton = await frame.$(
      "div#QryPost1 button.btn.btn-full.form-button"
    );
    await filterSearchButton.evaluate((b) => b.click());
  } else {
    await frame.click("a.btn.btn-a.form-button");
  }
  await frame.waitForNavigation();

  await frame
    .waitForFunction(
      () => document.querySelector("#table-item-tbody").rows.length >= 2,
      { timeout: 8000 }
    )
    .catch((err) => console.log(err + ", has no search result data."));

  await frame.waitForTimeout(500 + Math.floor(Math.random() * 500));

  await fs.mkdir(`${screenShotDir}/`, { recursive: true });
  const cases = await frame.$$("tbody#table-item-tbody tr");

  // in order to screenshot properly, page size should be adjusted to bigger than row element size due to rwd changing,
  // but should be adjusted until before next time rwd changing.
  const rowPixel = await cases[0].boundingBox();
  console.log(`rowPixel: ${JSON.stringify(rowPixel)}`);
  const viewportConfig = {
    width: Math.ceil(rowPixel.width),
    height: pageHeight,
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: false,
    isMobile: false,
  };
  console.log(`original page width: ${viewportConfig.width}`);
  for (let i = 0; i < 20; i++) {
    viewportConfig.width += 5;
    await page.setViewport(viewportConfig);
    await frame.waitForTimeout(200 + Math.floor(Math.random() * 100));
    const newRowPixel = await cases[0].boundingBox();
    if (newRowPixel.width > rowPixel.width) {
      viewportConfig.width -= 5;
      await page.setViewport(viewportConfig);
      await frame.waitForTimeout(200 + Math.floor(Math.random() * 100));
      break;
    }
  }
  console.log(`new page width: ${viewportConfig.width}`);

  const rowTitle = await frame.$("thead#table-item-head tr");
  const rowTitleImgBuf = await rowTitle.screenshot();
  for (const [idx, row] of cases.entries()) {
    if (idx >= 5) break;

    const addressLinkToOpenDetail = await row.$("td a");
    if (addressLinkToOpenDetail === null) break;

    await addressLinkToOpenDetail.evaluate((a) => a.click());
    const caseDetailTable = await frame.waitForSelector(
      "tbody#table-item-tbody tr.child"
    );
    const addressRowImgBuf = await row.screenshot();
    await frame.waitForTimeout(500 + Math.floor(Math.random() * 350));
    const caseDetailTableImgBuf = await caseDetailTable.screenshot();
    await sharp(caseDetailTableImgBuf)
      .extend({ top: 66, background: "white" })
      .composite([
        {
          input: rowTitleImgBuf,
          gravity: "northwest",
        },
        {
          input: addressRowImgBuf,
          top: 33,
          left: 0,
        },
      ])
      .toFile(`${screenShotDir}/scrnsht_${Date.now()}.png`);
    await frame.waitForTimeout(300 + Math.floor(Math.random() * 300));
  }

  console.log("Close browser");
  await browser.close();
}

async function retry(fn, retryDelay = 1000, numRetries = 3) {
  for (let i = 0; i <= numRetries; i++) {
    if (i !== 0) console.log("retry...");
    try {
      return await fn();
    } catch (e) {
      if (i === numRetries) throw e;
      await delay(retryDelay);
      retryDelay = retryDelay * 2;
    }
  }
}

async function replyToUser(replyToken, messageObjects) {
  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken,
      messages: messageObjects,
    },
    {
      headers: {
        Authorization: `Bearer ${config.webhook.line.channelAccessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
}

function changeWord(str) {
  return str.replace("台", "臺");
}

function hasValidWordCollection(arr) {
  if (arr.length !== 2 && arr.length !== 3 && arr.length !== 4) return false;

  const cityTownMapping = constants.CITY_TOWN_MAPPING;
  const city = changeWord(arr[0]);
  const district = arr[1];

  if (!cityTownMapping[city]) return false;
  if (!cityTownMapping[city].includes(district)) return false;

  return true;
}

module.exports = handleLineWebhook;
