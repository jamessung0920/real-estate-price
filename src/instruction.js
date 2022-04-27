function getBuysellStepInstruction() {
  return [
    {
      type: "text",
      text: "請輸入您要查詢的鄉鎮市區。\n\n格式為: xx市 xx區\nEX:",
    },
    {
      type: "text",
      text: "台中市 北屯區",
    },
  ];
}

function getPresaleStepInstruction() {
  return [
    {
      type: "text",
      text: "請輸入您要查詢的鄉鎮市區、以及建案名稱。\n\n格式為: xx市 xx區 案件名稱\nEX:",
    },
    {
      type: "text",
      text: "台中市 北屯區 林頂",
    },
  ];
}

module.exports = {
  getBuysellStepInstruction,
  getPresaleStepInstruction,
};
