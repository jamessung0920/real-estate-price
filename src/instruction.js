function getBuysellActionInstruction() {
  return [
    {
      type: "text",
      text: "請輸入您要查詢的鄉鎮市區。\n\n格式為: xx市 xx區",
    },
    {
      type: "text",
      text: "可參照以下範例:",
    },
    {
      type: "text",
      text: "台中市 北屯區",
    },
  ];
}

function getPresaleActionInstruction() {
  return [
    {
      type: "text",
      text: "請輸入您要查詢的鄉鎮市區、以及建案名稱。\n\n格式為: xx市 xx區 案件名稱(可留白)",
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
  ];
}

module.exports = {
  getBuysellActionInstruction,
  getPresaleActionInstruction,
};
