(function () {
  "use strict";

  var dayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  var now = new Date();

  var cardDay = document.getElementById("cardDay");
  var cardTime = document.getElementById("cardTime");
  var year = document.getElementById("year");

  if (cardDay) cardDay.textContent = dayNames[now.getDay()];
  if (year) year.textContent = String(now.getFullYear());

  function updateClock() {
    if (!cardTime) return;
    var date = new Date();
    cardTime.textContent =
      String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  updateClock();
  setInterval(updateClock, 30000);

  var toast = document.getElementById("toast");
  var toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  var greetBtn = document.getElementById("greetBtn");
  var greetLabel = document.getElementById("greetLabel");
  var greeted = false;

  if (greetBtn && greetLabel) {
    greetBtn.addEventListener("click", function () {
      greeted = !greeted;
      greetLabel.textContent = greeted ? "你好，今天也要好好的" : "向今天说声你好";
      showToast(greeted ? "你好呀，很高兴在这个时刻遇见你。" : "愿这句问候，轻轻落在你心上。");
    });
  }

  var target = "一位老朋友";
  var chips = document.querySelectorAll(".chip");

  Array.prototype.forEach.call(chips, function (chip) {
    chip.addEventListener("click", function () {
      Array.prototype.forEach.call(chips, function (item) {
        item.classList.remove("is-active");
      });
      chip.classList.add("is-active");
      target = chip.getAttribute("data-greet") || "一位老朋友";
      var kicker = document.querySelector(".note-kicker");
      if (kicker) kicker.textContent = "TO：" + target;
      showToast("已选择：" + target);
    });
  });

  var notes = {
    "一位老朋友": [
      "好久不见。今天的天气很好，忽然想起你。想告诉你：我很好，也祝你一切都好。",
      "不知道你最近忙不忙。想约你喝杯茶，把没说完的话慢慢说完。",
      "路过我们以前常去的那条街，店还开着。下次一起走走吧。"
    ],
    "家人": [
      "今天的饭菜还合胃口吗？记得按时吃饭，别总把最好的留给我们。",
      "最近降温了，出门多穿一件。等忙完这阵子，我就回家看看。",
      "有些话平时不好意思说：谢谢你们，也真的很爱你们。"
    ],
    "身边的同事": [
      "今天辛苦了。你处理问题时的耐心，我都看在眼里。",
      "谢谢你上次的帮忙，一直记在心里。改天请你喝咖啡。",
      "早上好呀。新的一天，愿你的待办清单短一点，好心情长一点。"
    ],
    "镜子里的自己": [
      "你已经做得很好了。慢一点也没关系，路还长，光也会来。",
      "今天也要好好吃饭、好好睡觉。你值得被自己温柔对待。",
      "别着急成为谁，先好好成为你自己。你好，今天也请多关照。"
    ]
  };

  var warmBtn = document.getElementById("warmBtn");
  var noteText = document.getElementById("noteText");
  var noteIndex = 0;

  if (warmBtn && noteText) {
    warmBtn.addEventListener("click", function () {
      var pool = notes[target] || notes["一位老朋友"];
      noteIndex = (noteIndex + 1) % pool.length;
      noteText.textContent = pool[noteIndex];
      showToast("一句话已经准备好，去说给 TA 听吧。");
    });
  }
})();
