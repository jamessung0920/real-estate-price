const fs = require("fs/promises");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
// const puppeteer = require("puppeteer");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const randomUseragent = require("random-useragent");

const constants = require("./constant");
const config = require("./config");
const instruction = require("./instruction");

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
  const screenShotPath = `/app/downloads/${randomDirName}`;
  if (Array.isArray(reqBody.events) && reqBody.events.length === 0) return;

  Promise.allSettled(
    reqBody.events.map(async (event) => {
      // type may be message, follow, unfollow and so on
      if (event.type !== "message" || event.mode !== "active") return;

      const userInput = event.message.text;
      const { userId } = event.source;
      let messageObjects = [];
      switch (userInput) {
        case constants.RICH_MENU_ACTION.BUYSELL: {
          console.log("買賣查詢");
          const userActionCache = { step: "BUYSELL" };
          await redisClient.set(userId, JSON.stringify(userActionCache), {
            EX: config.redis.expireTime,
            NX: true,
          });
          messageObjects = instruction.getBuysellStepInstruction();
          break;
        }
        case constants.RICH_MENU_ACTION.PRESALE: {
          console.log("預售屋查詢");
          const userActionCache = { step: "PRESALE" };
          await redisClient.set(userId, JSON.stringify(userActionCache), {
            EX: config.redis.expireTime,
            NX: true,
          });
          messageObjects = instruction.getPresaleStepInstruction();
          break;
        }
        default: {
          console.log("查詢結果");
          const userActionCache = await redisClient.get(userId);
          const step = userActionCache ? JSON.parse(userActionCache).step : "";
          if (!step) {
            messageObjects.push({
              type: "text",
              text: "請選擇動作，買賣查詢 or 預售屋查詢",
            });
            break;
          }

          const userInputArray = userInput.split(" ");
          const city = userInputArray[0];
          const district = userInputArray[1];
          let buildCaseName;
          if (step === "PRESALE") buildCaseName = userInputArray[2];

          await visitSite(city, district, buildCaseName, screenShotPath);

          const files = await fs.readdir(screenShotPath);
          const screenShotFiles = files
            .filter((fileName) => fileName.startsWith("scrnsht_"))
            .sort((b, c) => {
              if (b > c) return 1;
              if (c > b) return -1;
              return 0;
            });

          for (const file of screenShotFiles) {
            messageObjects.push({
              type: "image",
              originalContentUrl: `https://${headers.host}/static/${randomDirName}/${file}`,
              previewImageUrl: `https://${headers.host}/static/${randomDirName}/${file}`,
            });
          }

          await redisClient.del(userId);
          break;
        }
      }

      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        {
          replyToken: event.replyToken,
          messages: messageObjects,
        },
        {
          headers: {
            Authorization: `Bearer ${config.webhook.line.channelAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    })
  ).catch((err) => console.error(err));
}

async function visitSite(city, district, buildCaseName, screenShotPath) {
  const browser = await puppeteer.launch({
    // headless: false,
    args: ["--no-sandbox", `--proxy-server=http://${config.proxy.ip}:3128`],
    // executablePath: "/opt/homebrew/bin/chromium",
  });
  const page = (await browser.pages())[0];

  page.on("console", (msg) => console.log(msg.text()));

  const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.79 Safari/537.36";
  const userAgent = randomUseragent.getRandom();
  const UA = userAgent || DEFAULT_USER_AGENT;

  await page.setViewport({
    width: 375 + Math.floor(Math.random() * 70),
    height: 810 + Math.floor(Math.random() * 20),
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
  await page.goto(`https://lvr.land.moi.gov.tw`, {
    timeout: 0,
  });
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
  }, changeWord(city));

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

  await frame.waitForTimeout(200 + Math.floor(Math.random() * 350));
  await frame.click("a.btn.btn-a.form-button");
  await frame.waitForNavigation();

  await frame.waitForFunction(
    () => document.querySelector("#table-item-tbody").rows.length >= 5
  );

  await frame.waitForTimeout(200 + Math.floor(Math.random() * 500));

  await fs.mkdir(`${screenShotPath}/`, { recursive: true });
  const cases = await frame.$$("tbody#table-item-tbody tr");
  for (const [idx, row] of Object.entries(cases)) {
    if (idx >= 5) break;
    const addressLinkToOpenDetail = await row.$("td a");
    await addressLinkToOpenDetail.click();
    const caseDetailTable = await frame.waitForSelector(
      "tbody#table-item-tbody tr.child"
    );
    await caseDetailTable.screenshot({
      path: `${screenShotPath}/scrnsht_${Date.now()}.png`,
    });
    await frame.waitForTimeout(300 + Math.floor(Math.random() * 300));
  }

  await browser.close();
}

function changeWord(str) {
  return str.replace("台", "臺");
}
module.exports = handleLineWebhook;
