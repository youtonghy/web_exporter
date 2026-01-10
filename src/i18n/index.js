(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const FALLBACK_LOCALE = "zh-CN";
  const RESOURCES = {
    "zh-CN": {
      "app.title": "网页元素导出",
      "label.export_format": "导出格式",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "toggle.preserve_styles": "保留格式（样式）",
      "toggle.enhanced_images": "有图模式增强版",
      "button.select_export": "选择元素并导出",
      "hint.select_element": "点击按钮后，在页面上点选元素。按 Esc 取消。",
      "overlay.select_prompt": "点击选择元素，Esc 取消",
      "status.injection_error": "无法发送到页面或页面禁止注入脚本，请刷新页面或确认权限。",
      "error.no_active_tab": "未找到当前活动标签页。",
      "error.tabs_unavailable": "无法使用 Tabs API。",
      "error.scripting_unavailable": "无法使用脚本注入 API。",
      "alert.print_blocked": "无法打开打印窗口，请检查浏览器弹窗设置。",
      "print.window_title": "导出内容",
      "file.default_name": "导出内容",
      "action.title": "导出页面元素"
    },
    en: {
      "app.title": "Web Element Export",
      "label.export_format": "Export format",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "toggle.preserve_styles": "Preserve styles",
      "toggle.enhanced_images": "Enhanced image loading mode",
      "button.select_export": "Select element and export",
      "hint.select_element": "Click the button, then pick an element on the page. Press Esc to cancel.",
      "overlay.select_prompt": "Click to select an element, Esc to cancel",
      "status.injection_error": "Couldn't send to the page or script injection is blocked. Refresh the page or check permissions.",
      "error.no_active_tab": "No active tab found.",
      "error.tabs_unavailable": "Tabs API unavailable.",
      "error.scripting_unavailable": "Scripting API unavailable.",
      "alert.print_blocked": "Unable to open the print window. Please check your popup settings.",
      "print.window_title": "Exported Selection",
      "file.default_name": "exported-selection",
      "action.title": "Export page element"
    },
    ja: {
      "app.title": "Web要素エクスポート",
      "label.export_format": "エクスポート形式",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "toggle.preserve_styles": "スタイルを保持",
      "toggle.enhanced_images": "画像読み込み強化モード",
      "button.select_export": "要素を選択してエクスポート",
      "hint.select_element": "ボタンをクリックしてから、ページ上の要素を選択します。Esc でキャンセル。",
      "overlay.select_prompt": "クリックして要素を選択、Esc でキャンセル",
      "status.injection_error": "ページに送信できないか、スクリプト注入がブロックされています。ページを更新するか権限を確認してください。",
      "error.no_active_tab": "アクティブなタブが見つかりません。",
      "error.tabs_unavailable": "Tabs API を利用できません。",
      "error.scripting_unavailable": "スクリプト注入 API を利用できません。",
      "alert.print_blocked": "印刷ウィンドウを開けません。ポップアップ設定を確認してください。",
      "print.window_title": "選択内容の書き出し",
      "file.default_name": "選択内容",
      "action.title": "ページ要素をエクスポート"
    },
    ko: {
      "app.title": "웹 요소 내보내기",
      "label.export_format": "내보내기 형식",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "toggle.preserve_styles": "스타일 유지",
      "toggle.enhanced_images": "이미지 로딩 강화 모드",
      "button.select_export": "요소 선택 후 내보내기",
      "hint.select_element": "버튼을 클릭한 뒤 페이지에서 요소를 선택하세요. Esc 를 누르면 취소됩니다.",
      "overlay.select_prompt": "클릭하여 요소를 선택하고 Esc 로 취소",
      "status.injection_error": "페이지에 전송할 수 없거나 스크립트 주입이 차단되었습니다. 페이지를 새로 고치거나 권한을 확인하세요.",
      "error.no_active_tab": "활성 탭을 찾을 수 없습니다.",
      "error.tabs_unavailable": "Tabs API를 사용할 수 없습니다.",
      "error.scripting_unavailable": "스크립트 주입 API를 사용할 수 없습니다.",
      "alert.print_blocked": "인쇄 창을 열 수 없습니다. 팝업 설정을 확인하세요.",
      "print.window_title": "선택 항목 내보내기",
      "file.default_name": "선택 항목",
      "action.title": "페이지 요소 내보내기"
    },
    es: {
      "app.title": "Exportar elementos web",
      "label.export_format": "Formato de exportación",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "toggle.preserve_styles": "Conservar estilos",
      "toggle.enhanced_images": "Modo de carga de imágenes mejorado",
      "button.select_export": "Seleccionar elemento y exportar",
      "hint.select_element": "Haz clic en el botón y luego selecciona un elemento en la página. Pulsa Esc para cancelar.",
      "overlay.select_prompt": "Haz clic para seleccionar un elemento, Esc para cancelar",
      "status.injection_error": "No se pudo enviar a la página o la inyección de scripts está bloqueada. Actualiza la página o revisa los permisos.",
      "error.no_active_tab": "No se encontró ninguna pestaña activa.",
      "error.tabs_unavailable": "Tabs API no disponible.",
      "error.scripting_unavailable": "API de inyección de scripts no disponible.",
      "alert.print_blocked": "No se puede abrir la ventana de impresión. Revisa la configuración de ventanas emergentes.",
      "print.window_title": "Selección exportada",
      "file.default_name": "seleccion-exportada",
      "action.title": "Exportar elemento de la página"
    },
    de: {
      "app.title": "Web-Elemente exportieren",
      "label.export_format": "Exportformat",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "toggle.preserve_styles": "Stile beibehalten",
      "toggle.enhanced_images": "Erweiterter Bildlademodus",
      "button.select_export": "Element auswählen und exportieren",
      "hint.select_element": "Klicke auf die Schaltfläche und wähle dann ein Element auf der Seite aus. Esc zum Abbrechen.",
      "overlay.select_prompt": "Klicken, um ein Element auszuwählen, Esc zum Abbrechen",
      "status.injection_error": "Die Seite konnte nicht erreicht werden oder die Skriptinjektion ist blockiert. Seite aktualisieren oder Berechtigungen prüfen.",
      "error.no_active_tab": "Kein aktiver Tab gefunden.",
      "error.tabs_unavailable": "Tabs API nicht verfügbar.",
      "error.scripting_unavailable": "Skriptinjektions-API nicht verfügbar.",
      "alert.print_blocked": "Druckfenster konnte nicht geöffnet werden. Bitte Popup-Einstellungen prüfen.",
      "print.window_title": "Exportierte Auswahl",
      "file.default_name": "exportierte-auswahl",
      "action.title": "Seitenelement exportieren"
    },
    fr: {
      "app.title": "Exporter des éléments web",
      "label.export_format": "Format d’exportation",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "toggle.preserve_styles": "Conserver les styles",
      "toggle.enhanced_images": "Mode de chargement d’images renforcé",
      "button.select_export": "Sélectionner l’élément et exporter",
      "hint.select_element": "Cliquez sur le bouton, puis sélectionnez un élément sur la page. Appuyez sur Esc pour annuler.",
      "overlay.select_prompt": "Cliquez pour sélectionner un élément, Esc pour annuler",
      "status.injection_error": "Impossible d’envoyer à la page ou l’injection de script est bloquée. Actualisez la page ou vérifiez les autorisations.",
      "error.no_active_tab": "Aucun onglet actif trouvé.",
      "error.tabs_unavailable": "API Tabs indisponible.",
      "error.scripting_unavailable": "API d’injection de scripts indisponible.",
      "alert.print_blocked": "Impossible d’ouvrir la fenêtre d’impression. Vérifiez les paramètres de fenêtre contextuelle.",
      "print.window_title": "Sélection exportée",
      "file.default_name": "selection-exportee",
      "action.title": "Exporter l’élément de la page"
    }
  };

  function getBrowserLocale() {
    if (api && api.i18n && typeof api.i18n.getUILanguage === "function") {
      return api.i18n.getUILanguage();
    }
    if (navigator.languages && navigator.languages.length) {
      return navigator.languages[0];
    }
    return navigator.language || "";
  }

  function resolveLocale(locale) {
    const normalized = (locale || "").trim();
    if (!normalized) {
      return FALLBACK_LOCALE;
    }
    if (RESOURCES[normalized]) {
      return normalized;
    }
    const lower = normalized.toLowerCase();
    const keys = Object.keys(RESOURCES);
    const exact = keys.find((key) => key.toLowerCase() === lower);
    if (exact) {
      return exact;
    }
    const primary = lower.split("-")[0];
    const primaryMatch = keys.find((key) => key.toLowerCase() === primary);
    if (primaryMatch) {
      return primaryMatch;
    }
    if (lower.startsWith("zh")) {
      return "zh-CN";
    }
    return FALLBACK_LOCALE;
  }

  let currentLocale = resolveLocale(getBrowserLocale());

  function t(key, replacements) {
    const fallbackTable = RESOURCES[FALLBACK_LOCALE] || {};
    const table = RESOURCES[currentLocale] || fallbackTable;
    let value = table[key] || fallbackTable[key] || key;
    if (replacements && typeof value === "string") {
      Object.keys(replacements).forEach((token) => {
        value = value.replace(new RegExp(`\\{${token}\\}`, "g"), String(replacements[token]));
      });
    }
    return value;
  }

  function setLocale(locale) {
    currentLocale = resolveLocale(locale);
    return currentLocale;
  }

  function getLocale() {
    return currentLocale;
  }

  function applyTranslations(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll("[data-i18n]");
    nodes.forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (!key) {
        return;
      }
      node.textContent = t(key);
    });
  }

  globalThis.WebExporterI18n = {
    t,
    setLocale,
    getLocale,
    applyTranslations
  };
})();
