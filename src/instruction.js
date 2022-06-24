function getBuysellActionInstruction() {
  return [
    {
      type: "text",
      text: "請輸入您要查詢的鄉鎮市區、以及完整或部份地段/道路名稱。查詢結果來自於內政部網站，需花15-20秒抓取。\n\n⚠️注意⚠️: 除上述欄位以外，其餘之欄位皆使用網頁預設值搜尋。\n⚠️注意⚠️:若搜尋結果之表格欄位資料過長，會用...省略，詳情請至官網查詢。\n\n格式為: xx市(or縣) xx區(or鄉鎮市) xx路(可留白)",
    },
    {
      type: "text",
      text: "可參照以下範例:",
    },
    {
      type: "text",
      text: "台中市 北屯區 崇德八路一段",
    },
    {
      type: "text",
      text: "台中市 北屯區",
    },
    {
      type: "text",
      text: "苗栗縣 通霄鎮",
    },
  ];
}

function getPresaleActionInstruction() {
  return [
    {
      type: "text",
      text: "請輸入您要查詢的鄉鎮市區、以及完整或部份建案名稱。查詢結果來自於內政部網站，需花15-20秒抓取。\n\n⚠️注意⚠️: 除上述欄位以外，其餘之欄位皆使用網頁預設值搜尋。\n⚠️注意⚠️:若搜尋結果之表格欄位資料過長，會用...省略，詳情請至官網查詢。\n\n格式為: xx市(or縣) xx區(or鄉鎮市) 建案名稱(可留白)",
    },
    {
      type: "text",
      text: "可參照以下範例:",
    },
    {
      type: "text",
      text: "台中市 北屯區 林頂",
    },
    {
      type: "text",
      text: "台中市 北屯區",
    },
    {
      type: "text",
      text: "苗栗縣 通霄鎮",
    },
  ];
}

module.exports = {
  getBuysellActionInstruction,
  getPresaleActionInstruction,
};
