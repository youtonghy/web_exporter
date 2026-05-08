(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const FALLBACK_LOCALE = "zh-CN";
  const RESOURCES = {
    "zh-CN": {
      "app.title": "网页元素导出",
      "label.pdf_engine": "PDF 导出引擎",
      "option.pdf_engine.cdp": "浏览器 CDP 导出（推荐）",
      "option.pdf_engine.html2canvas": "Canvas 渲染导出",
      "option.pdf_engine.native": "原生打印导出",
      "error.cdp_unavailable": "CDP 导出失败，已切换到原生打印。",
      "error.html2canvas_unavailable": "Canvas 渲染导出失败，已切换到原生打印。",
      "hint.pdf_engine_cdp": "使用 Chrome 内置排版引擎，文字可选、体积小。",
      "hint.pdf_engine_html2canvas": "所见即所得，适合复杂布局，但文字变为图片。",
      "hint.pdf_engine_native": "依赖浏览器打印对话框，部分样式可能丢失。",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "option.png": "PNG",
      "toggle.preserve_styles": "保留格式（样式）",
      "toggle.enhanced_images": "有图模式增强版",
      "toggle.image_packaging": "打包图片（生成 ZIP）",
      "toggle.debug_mode": "调试模式",
      "hint.debug_mode": "导出时记录节点、样式和 HTML 片段，并下载调试包。",
      "button.select_export": "选择元素并导出",
      "hint.select_element": "点击按钮后，在页面上点选元素。按 Esc 取消。",
      "overlay.select_prompt": "点击选择元素，Esc 取消",
      "status.injection_error": "无法发送到页面或页面禁止注入脚本，请刷新页面或确认权限。",
      "error.no_active_tab": "未找到当前活动标签页。",
      "error.tabs_unavailable": "无法使用 Tabs API。",
      "error.scripting_unavailable": "无法使用脚本注入 API。",
      "error.runtime_unavailable": "无法使用 Runtime API。",
      "error.capture_failed": "截图失败，请确认插件权限或重试。",
      "alert.png_not_visible": "所选内容不在当前可见区域，请先滚动到可见位置再导出。",
      "alert.print_blocked": "无法打开打印窗口，请检查浏览器弹窗设置。",
      "print.window_title": "导出内容",
      "file.default_name": "导出内容",
      "action.title": "导出页面元素"
    },
    en: {
      "app.title": "Web Element Export",
      "label.export_format": "Export format",
      "label.pdf_engine": "PDF export engine",
      "option.pdf_engine.cdp": "Browser CDP export (recommended)",
      "option.pdf_engine.html2canvas": "Canvas render export",
      "option.pdf_engine.native": "Native print export",
      "error.cdp_unavailable": "CDP export failed, switched to native print.",
      "error.html2canvas_unavailable": "Canvas render export failed, switched to native print.",
      "hint.pdf_engine_cdp": "Uses Chrome built-in layout engine; text selectable, small file size.",
      "hint.pdf_engine_html2canvas": "WYSIWYG, good for complex layouts, but text becomes images.",
      "hint.pdf_engine_native": "Relies on browser print dialog; some styles may be lost.",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "option.png": "PNG",
      "toggle.preserve_styles": "Preserve styles",
      "toggle.enhanced_images": "Enhanced image loading mode",
      "toggle.image_packaging": "Package images (ZIP)",
      "toggle.debug_mode": "Debug mode",
      "hint.debug_mode": "Logs node, style, and HTML snippets, then downloads a debug bundle.",
      "button.select_export": "Select element and export",
      "hint.select_element": "Click the button, then pick an element on the page. Press Esc to cancel.",
      "overlay.select_prompt": "Click to select an element, Esc to cancel",
      "status.injection_error": "Couldn't send to the page or script injection is blocked. Refresh the page or check permissions.",
      "error.no_active_tab": "No active tab found.",
      "error.tabs_unavailable": "Tabs API unavailable.",
      "error.scripting_unavailable": "Scripting API unavailable.",
      "error.runtime_unavailable": "Runtime API unavailable.",
      "error.capture_failed": "Screenshot capture failed. Check extension permissions and try again.",
      "alert.png_not_visible": "The selected area is not visible. Scroll it into view before exporting.",
      "alert.print_blocked": "Unable to open the print window. Please check your popup settings.",
      "print.window_title": "Exported Selection",
      "file.default_name": "exported-selection",
      "action.title": "Export page element"
    },
    ja: {
      "app.title": "Web要素エクスポート",
      "label.pdf_engine": "PDFエクスポートエンジン",
      "option.pdf_engine.cdp": "ブラウザCDPエクスポート（推奨）",
      "option.pdf_engine.html2canvas": "Canvasレンダリングエクスポート",
      "option.pdf_engine.native": "ネイティブ印刷エクスポート",
      "error.cdp_unavailable": "CDPエクスポートに失敗しました。ネイティブ印刷に切り替えます。",
      "error.html2canvas_unavailable": "Canvasレンダリングエクスポートに失敗しました。ネイティブ印刷に切り替えます。",
      "hint.pdf_engine_cdp": "Chrome組み込みレイアウトエンジンを使用。テキスト選択可能、ファイルサイズ小。",
      "hint.pdf_engine_html2canvas": "WYSIWYG、複雑なレイアウトに適していますが、テキストが画像になります。",
      "hint.pdf_engine_native": "ブラウザの印刷ダイアログに依存します。一部のスタイルが失われる場合があります。",
      "label.export_format": "エクスポート形式",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "option.png": "PNG",
      "toggle.preserve_styles": "スタイルを保持",
      "toggle.enhanced_images": "画像読み込み強化モード",
      "toggle.image_packaging": "画像をパッケージ（ZIP）",
      "toggle.debug_mode": "デバッグモード",
      "hint.debug_mode": "ノード、スタイル、HTML の抜粋を記録してデバッグ用バンドルを保存します。",
      "button.select_export": "要素を選択してエクスポート",
      "hint.select_element": "ボタンをクリックしてから、ページ上の要素を選択します。Esc でキャンセル。",
      "overlay.select_prompt": "クリックして要素を選択、Esc でキャンセル",
      "status.injection_error": "ページに送信できないか、スクリプト注入がブロックされています。ページを更新するか権限を確認してください。",
      "error.no_active_tab": "アクティブなタブが見つかりません。",
      "error.tabs_unavailable": "Tabs API を利用できません。",
      "error.scripting_unavailable": "スクリプト注入 API を利用できません。",
      "error.runtime_unavailable": "Runtime API を利用できません。",
      "error.capture_failed": "スクリーンショットの取得に失敗しました。権限を確認して再試行してください。",
      "alert.png_not_visible": "選択範囲が表示領域外です。表示される位置までスクロールしてからエクスポートしてください。",
      "alert.print_blocked": "印刷ウィンドウを開けません。ポップアップ設定を確認してください。",
      "print.window_title": "選択内容の書き出し",
      "file.default_name": "選択内容",
      "action.title": "ページ要素をエクスポート"
    },
    ko: {
      "app.title": "웹 요소 내보내기",
      "label.pdf_engine": "PDF 내보내기 엔진",
      "option.pdf_engine.cdp": "브라우저 CDP 내보내기 (권장)",
      "option.pdf_engine.html2canvas": "Canvas 렌더링 내보내기",
      "option.pdf_engine.native": "네이티브 인쇄 내보내기",
      "error.cdp_unavailable": "CDP 내보내기에 실패했습니다. 네이티브 인쇄로 전환합니다.",
      "error.html2canvas_unavailable": "Canvas 렌더링 내보내기에 실패했습니다. 네이티브 인쇄로 전환합니다.",
      "hint.pdf_engine_cdp": "Chrome 내장 레이아웃 엔진 사용. 텍스트 선택 가능, 파일 크기 작음.",
      "hint.pdf_engine_html2canvas": "WYSIWYG, 복잡한 레이아웃에 적합하지만 텍스트가 이미지가 됩니다.",
      "hint.pdf_engine_native": "브라우저 인쇄 대화 상자에 의존. 일부 스타일이 손실될 수 있습니다.",
      "label.export_format": "내보내기 형식",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "option.png": "PNG",
      "toggle.preserve_styles": "스타일 유지",
      "toggle.enhanced_images": "이미지 로딩 강화 모드",
      "toggle.image_packaging": "이미지 패키징 (ZIP)",
      "toggle.debug_mode": "디버그 모드",
      "hint.debug_mode": "노드, 스타일, HTML 일부를 기록하고 디버그 번들을 다운로드합니다.",
      "button.select_export": "요소 선택 후 내보내기",
      "hint.select_element": "버튼을 클릭한 뒤 페이지에서 요소를 선택하세요. Esc 를 누르면 취소됩니다.",
      "overlay.select_prompt": "클릭하여 요소를 선택하고 Esc 로 취소",
      "status.injection_error": "페이지에 전송할 수 없거나 스크립트 주입이 차단되었습니다. 페이지를 새로 고치거나 권한을 확인하세요.",
      "error.no_active_tab": "활성 탭을 찾을 수 없습니다.",
      "error.tabs_unavailable": "Tabs API를 사용할 수 없습니다.",
      "error.scripting_unavailable": "스크립트 주입 API를 사용할 수 없습니다.",
      "error.runtime_unavailable": "Runtime API를 사용할 수 없습니다.",
      "error.capture_failed": "스크린샷 캡처에 실패했습니다. 권한을 확인하고 다시 시도하세요.",
      "alert.png_not_visible": "선택한 영역이 현재 화면에 보이지 않습니다. 보이는 위치로 스크롤한 뒤 내보내세요.",
      "alert.print_blocked": "인쇄 창을 열 수 없습니다. 팝업 설정을 확인하세요.",
      "print.window_title": "선택 항목 내보내기",
      "file.default_name": "선택 항목",
      "action.title": "페이지 요소 내보내기"
    },
    es: {
      "app.title": "Exportar elementos web",
      "label.pdf_engine": "Motor de exportación PDF",
      "option.pdf_engine.cdp": "Exportar con CDP del navegador (recomendado)",
      "option.pdf_engine.html2canvas": "Exportar con renderizado Canvas",
      "option.pdf_engine.native": "Exportar con impresión nativa",
      "error.cdp_unavailable": "Error al exportar con CDP. Se cambió a impresión nativa.",
      "error.html2canvas_unavailable": "Error al exportar con Canvas. Se cambió a impresión nativa.",
      "hint.pdf_engine_cdp": "Usa el motor de diseño integrado de Chrome; texto seleccionable, archivo pequeño.",
      "hint.pdf_engine_html2canvas": "WYSIWYG, bueno para diseños complejos, pero el texto se convierte en imágenes.",
      "hint.pdf_engine_native": "Depende del diálogo de impresión del navegador; algunos estilos pueden perderse.",
      "label.export_format": "Formato de exportación",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "option.png": "PNG",
      "toggle.preserve_styles": "Conservar estilos",
      "toggle.enhanced_images": "Modo de carga de imágenes mejorado",
      "toggle.image_packaging": "Empaquetar imágenes (ZIP)",
      "toggle.debug_mode": "Modo de depuración",
      "hint.debug_mode": "Registra nodos, estilos y fragmentos HTML, y luego descarga un paquete de depuración.",
      "button.select_export": "Seleccionar elemento y exportar",
      "hint.select_element": "Haz clic en el botón y luego selecciona un elemento en la página. Pulsa Esc para cancelar.",
      "overlay.select_prompt": "Haz clic para seleccionar un elemento, Esc para cancelar",
      "status.injection_error": "No se pudo enviar a la página o la inyección de scripts está bloqueada. Actualiza la página o revisa los permisos.",
      "error.no_active_tab": "No se encontró ninguna pestaña activa.",
      "error.tabs_unavailable": "Tabs API no disponible.",
      "error.scripting_unavailable": "API de inyección de scripts no disponible.",
      "error.runtime_unavailable": "Runtime API no disponible.",
      "error.capture_failed": "Falló la captura de pantalla. Revisa los permisos e inténtalo de nuevo.",
      "alert.png_not_visible": "La selección no está visible. Desplázate hasta verla antes de exportar.",
      "alert.print_blocked": "No se puede abrir la ventana de impresión. Revisa la configuración de ventanas emergentes.",
      "print.window_title": "Selección exportada",
      "file.default_name": "seleccion-exportada",
      "action.title": "Exportar elemento de la página"
    },
    de: {
      "app.title": "Web-Elemente exportieren",
      "label.pdf_engine": "PDF-Export-Engine",
      "option.pdf_engine.cdp": "Browser-CDP-Export (empfohlen)",
      "option.pdf_engine.html2canvas": "Canvas-Rendering-Export",
      "option.pdf_engine.native": "Nativer Druck-Export",
      "error.cdp_unavailable": "CDP-Export fehlgeschlagen, auf nativen Druck umgeschaltet.",
      "error.html2canvas_unavailable": "Canvas-Rendering-Export fehlgeschlagen, auf nativen Druck umgeschaltet.",
      "hint.pdf_engine_cdp": "Nutzt die eingebaute Chrome-Layout-Engine; Text auswählbar, kleine Datei.",
      "hint.pdf_engine_html2canvas": "WYSIWYG, gut für komplexe Layouts, aber Text wird zu Bildern.",
      "hint.pdf_engine_native": "Hängt vom Browser-Druckdialog ab; einige Stile können verloren gehen.",
      "label.export_format": "Exportformat",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "option.png": "PNG",
      "toggle.preserve_styles": "Stile beibehalten",
      "toggle.enhanced_images": "Erweiterter Bildlademodus",
      "toggle.image_packaging": "Bilder verpacken (ZIP)",
      "toggle.debug_mode": "Debug-Modus",
      "hint.debug_mode": "Protokolliert Knoten-, Stil- und HTML-Ausschnitte und lädt ein Debug-Paket herunter.",
      "button.select_export": "Element auswählen und exportieren",
      "hint.select_element": "Klicke auf die Schaltfläche und wähle dann ein Element auf der Seite aus. Esc zum Abbrechen.",
      "overlay.select_prompt": "Klicken, um ein Element auszuwählen, Esc zum Abbrechen",
      "status.injection_error": "Die Seite konnte nicht erreicht werden oder die Skriptinjektion ist blockiert. Seite aktualisieren oder Berechtigungen prüfen.",
      "error.no_active_tab": "Kein aktiver Tab gefunden.",
      "error.tabs_unavailable": "Tabs API nicht verfügbar.",
      "error.scripting_unavailable": "Skriptinjektions-API nicht verfügbar.",
      "error.runtime_unavailable": "Runtime API nicht verfügbar.",
      "error.capture_failed": "Screenshot-Erfassung fehlgeschlagen. Berechtigungen prüfen und erneut versuchen.",
      "alert.png_not_visible": "Die Auswahl ist nicht sichtbar. Bitte zuerst in den sichtbaren Bereich scrollen.",
      "alert.print_blocked": "Druckfenster konnte nicht geöffnet werden. Bitte Popup-Einstellungen prüfen.",
      "print.window_title": "Exportierte Auswahl",
      "file.default_name": "exportierte-auswahl",
      "action.title": "Seitenelement exportieren"
    },
    fr: {
      "app.title": "Exporter des éléments web",
      "label.pdf_engine": "Moteur d’exportation PDF",
      "option.pdf_engine.cdp": "Exportation CDP du navigateur (recommandé)",
      "option.pdf_engine.html2canvas": "Exportation par rendu Canvas",
      "option.pdf_engine.native": "Exportation par impression native",
      "error.cdp_unavailable": "Échec de l’exportation CDP, passage à l’impression native.",
      "error.html2canvas_unavailable": "Échec de l’exportation Canvas, passage à l’impression native.",
      "hint.pdf_engine_cdp": "Utilise le moteur de mise en page intégré de Chrome ; texte sélectionnable, petit fichier.",
      "hint.pdf_engine_html2canvas": "WYSIWYG, adapté aux mises en page complexes, mais le texte devient des images.",
      "hint.pdf_engine_native": "Dépend de la boîte de dialogue d’impression du navigateur ; certains styles peuvent être perdus.",
      "label.export_format": "Format d’exportation",
      "option.pdf": "PDF",
      "option.markdown": "Markdown",
      "option.png": "PNG",
      "toggle.preserve_styles": "Conserver les styles",
      "toggle.enhanced_images": "Mode de chargement d’images renforcé",
      "toggle.image_packaging": "Regrouper les images (ZIP)",
      "toggle.debug_mode": "Mode débogage",
      "hint.debug_mode": "Enregistre des extraits de nœuds, de styles et de HTML, puis télécharge un paquet de débogage.",
      "button.select_export": "Sélectionner l’élément et exporter",
      "hint.select_element": "Cliquez sur le bouton, puis sélectionnez un élément sur la page. Appuyez sur Esc pour annuler.",
      "overlay.select_prompt": "Cliquez pour sélectionner un élément, Esc pour annuler",
      "status.injection_error": "Impossible d’envoyer à la page ou l’injection de script est bloquée. Actualisez la page ou vérifiez les autorisations.",
      "error.no_active_tab": "Aucun onglet actif trouvé.",
      "error.tabs_unavailable": "API Tabs indisponible.",
      "error.scripting_unavailable": "API d’injection de scripts indisponible.",
      "error.runtime_unavailable": "API Runtime indisponible.",
      "error.capture_failed": "La capture d’écran a échoué. Vérifiez les autorisations puis réessayez.",
      "alert.png_not_visible": "La sélection n’est pas visible. Faites défiler jusqu’à la zone visible avant d’exporter.",
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
