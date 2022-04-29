function getBuysellActionInstruction() {
  return [
    {
      type: "text",
      text: "請輸入您要查詢的鄉鎮市區。查詢結果來自於內政部網站，需花15-20秒抓取。\n\n格式為: xx市(or縣) xx區(or鄉鎮市)",
    },
    {
      type: "text",
      text: "可參照以下範例:",
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
      text: "請輸入您要查詢的鄉鎮市區、以及建案名稱。查詢結果來自於內政部網站，需花15-20秒抓取。\n\n格式為: xx市(or縣) xx區(or鄉鎮市) 案件名稱(可留白)",
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
