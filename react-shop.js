(function () {
  const { useSyncExternalStore, useState, useEffect } = React;

  const TEXTS = {
    ko: {
      title: "사령부 외형 보관소",
      subtitle: "캠페인에서 획득한 영혼 표식으로 군단의 외형 테마를 해금하십시오. (게임 플레이에 영향을 주지 않는 순수 장식용)",
      balance: "보유 영혼 표식:",
      stipend: "300 표식 사령부 지원금 포함",
      purchase: "구매",
      equip: "장착",
      equipped: "장착됨",
      cost: "표식",
      errorNoFunds: "영혼 표식이 부족하여 구매할 수 없습니다.",
      successPurchase: "테마를 성공적으로 구매했습니다.",
      successEquip: "테마를 장착했습니다.",
      cosmeticOnly: "외형 전용"
    },
    en: {
      title: "Command Relic Chamber",
      subtitle: "Spend marks earned in campaign to unlock visual legion themes. (Purely cosmetic, no gameplay impact)",
      balance: "Soul Marks:",
      stipend: "includes 300-mark Command Stipend",
      purchase: "Purchase",
      equip: "Equip",
      equipped: "Equipped",
      cost: "Marks",
      errorNoFunds: "Insufficient marks. Purchase rejected.",
      successPurchase: "Theme purchased successfully.",
      successEquip: "Theme equipped successfully.",
      cosmeticOnly: "Cosmetic Only"
    }
  };

  function ShopApp() {
    const profile = useSyncExternalStore(
      window.AbyssalProfile.subscribe,
      window.AbyssalProfile.getSnapshot
    );

    const [lang, setLang] = useState(document.documentElement.lang || "ko");
    const [status, setStatus] = useState({ message: "", isError: false });
    const [pending, setPending] = useState(false);
    useEffect(() => {
      const observer = new MutationObserver(() => {
        setLang(document.documentElement.lang || "ko");
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"]
      });
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (status.message) {
        const timer = setTimeout(() => {
          setStatus({ message: "", isError: false });
        }, 4500);
        return () => clearTimeout(timer);
      }
    }, [status.message]);

    if (!profile) {
      return React.createElement("div", { className: "relic-shop-loading" }, "Loading...");
    }

    const t = TEXTS[lang] || TEXTS.ko;
    const items = Object.values(window.AbyssalProfile.CATALOG);

    const handlePurchase = async (id) => {
      if (pending) return;
      setPending(true);
      try {
        await window.AbyssalProfile.purchase(id);
        const item = window.AbyssalProfile.CATALOG[id];
        const name = lang === "ko" ? item.nameKo : item.nameEn;
        const msg = lang === "ko" ? `${name} 테마를 성공적으로 구매했습니다.` : `${name} purchased successfully.`;
        setStatus({ message: msg, isError: false });
      } catch (e) {
        let errorMsg = e.message;
        if (e.message === "Insufficient balance") {
          errorMsg = t.errorNoFunds;
        }
        setStatus({ message: errorMsg, isError: true });
      } finally {
        setPending(false);
      }
    };

    const handleEquip = async (id) => {
      if (pending) return;
      setPending(true);
      try {
        await window.AbyssalProfile.equip(id);
        const item = window.AbyssalProfile.CATALOG[id];
        const name = lang === "ko" ? item.nameKo : item.nameEn;
        const msg = lang === "ko" ? `${name} 테마를 장착했습니다.` : `${name} equipped successfully.`;
        setStatus({ message: msg, isError: false });
      } catch (e) {
        setStatus({ message: `Error: ${e.message}`, isError: true });
      } finally {
        setPending(false);
      }
    };

    return React.createElement(
      "section",
      {
        className: "relic-shop-container",
        "aria-label": lang === "ko" ? "외형 상점" : "Cosmetic Shop"
      },
      React.createElement(
        "header",
        { className: "relic-shop-header" },
        React.createElement("h3", { className: "relic-shop-title" }, t.title),
        React.createElement("p", { className: "relic-shop-subtitle" }, t.subtitle),
        React.createElement(
          "div",
          { className: "relic-shop-balance-wrapper" },
          React.createElement(
            "div",
            { className: "relic-shop-balance" },
            React.createElement("span", { className: "relic-shop-balance-label" }, t.balance),
            " ",
            React.createElement(
              "span",
              { className: "relic-shop-balance-value" },
              profile.balance,
              " ",
              t.cost
            )
          ),
          profile.hasReceivedStipend && React.createElement(
            "span",
            { className: "relic-shop-stipend-label" },
            t.stipend
          )
        )
      ),
      React.createElement(
        "div",
        { className: "relic-shop-catalog" },
        items.map((item) => {
          const isOwned = profile.ownedItems.includes(item.id);
          const isEquipped = profile.equippedTheme === item.id;
          const name = lang === "ko" ? item.nameKo : item.nameEn;
          const desc = lang === "ko" ? item.descKo : item.descEn;

          let btnText = "";
          let btnClassName = "relic-shop-btn";
          let btnDisabled = false;
          let onClickAction = null;

          if (isOwned) {
            if (isEquipped) {
              btnText = t.equipped;
              btnClassName += " relic-shop-btn-equipped";
              btnDisabled = true;
            } else {
              btnText = t.equip;
              btnClassName += " relic-shop-btn-equip";
              onClickAction = () => handleEquip(item.id);
            }
          } else {
            btnText = `${t.purchase} (${item.price} ${t.cost})`;
            btnClassName += " relic-shop-btn-purchase";
            if (profile.balance < item.price) {
              btnClassName += " relic-shop-btn-locked";
            }
            onClickAction = () => handlePurchase(item.id);
          }

          return React.createElement(
            "div",
            {
              key: item.id,
              className: `relic-shop-item ${isEquipped ? "relic-shop-item-equipped" : ""}`,
              "data-id": item.id
            },
            React.createElement("img", {
              className: "relic-shop-item-art",
              src: item.art,
              alt: name
            }),
            React.createElement(
              "div",
              { className: "relic-shop-item-info" },
              React.createElement("h4", { className: "relic-shop-item-name" }, name),
              React.createElement("p", { className: "relic-shop-item-desc" }, desc),
              React.createElement(
                "span",
                { className: "relic-shop-item-badge" },
                t.cosmeticOnly
              )
            ),
            React.createElement(
              "div",
              { className: "relic-shop-item-actions" },
              React.createElement(
                "button",
                {
                  className: btnClassName,
                  onClick: onClickAction,
                  disabled: btnDisabled || pending,
                  style: {
                    minWidth: "44px",
                    minHeight: "44px",
                    padding: "10px 16px",
                    cursor: (btnDisabled || pending) ? "default" : "pointer"
                  },
                  "aria-label": isOwned
                    ? (isEquipped ? `${name} ${t.equipped}` : `${t.equip} ${name}`)
                    : `${t.purchase} ${name} ${lang === "ko" ? "가격" : "for"} ${item.price} ${t.cost}`
                },
                btnText
              )
            )
          );
        })
      ),
      React.createElement(
        "div",
        {
          className: `relic-shop-status ${status.isError ? "relic-shop-status-error" : "relic-shop-status-success"}`,
          role: "status",
          "aria-live": "polite",
          style: {
            minHeight: "24px",
            marginTop: "12px",
            fontSize: "0.9rem",
            textAlign: "center"
          }
        },
        status.message
      )
    );
  }

  function initShop() {
    const container = document.getElementById("shop-root");
    if (container) {
      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(ShopApp));
    } else {
      const observer = new MutationObserver((mutations, obs) => {
        const container = document.getElementById("shop-root");
        if (container) {
          const root = ReactDOM.createRoot(container);
          root.render(React.createElement(ShopApp));
          obs.disconnect();
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

      window.addEventListener("DOMContentLoaded", () => {
        const container = document.getElementById("shop-root");
        if (container) {
          try {
            const root = ReactDOM.createRoot(container);
            root.render(React.createElement(ShopApp));
          } catch(e){}
          observer.disconnect();
        }
      });
    }
  }

  initShop();
})();
