chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open-multi-translator-panel-google",
    title: "Googleで翻訳する",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "open-multi-translator-panel-deepl",
    title: "Deeplで翻訳する",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "open-multi-translator-panel-mymemory",
    title: "MyMemoryで翻訳する",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-multi-translator-panel-google") {
    chrome.sidePanel.open({ tabId: tab.id });
    chrome.storage.local.set({ input: info.selectionText, servicesConfig: ["google"] });
  } else if (info.menuItemId === "open-multi-translator-panel-deepl") {
    chrome.sidePanel.open({ tabId: tab.id });
    chrome.storage.local.set({ input: info.selectionText, servicesConfig: ["deepl"] });
  } else if (info.menuItemId === "open-multi-translator-panel-mymemory") {
    chrome.sidePanel.open({ tabId: tab.id });
    chrome.storage.local.set({ input: info.selectionText, servicesConfig: ["mymemory"] });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translateDeepl") {
    (async () => {
      if (!request.text.trim()) {
        sendResponse({ success: true, text: "" });
        return;
      }

      const result = await chrome.storage.local.get(['deeplApiKey']);
      const apiKey = result.deeplApiKey;

      if (!apiKey) {
        sendResponse({ success: false, text: "DeepLのAPIキーが未設定です。下部の入力欄にキーを設定してください。" });
        return;
      }
      
      const isFree = apiKey.endsWith(':fx');
      const url = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            text: request.text,
            source_lang: request.inlang.toUpperCase(),
            target_lang: request.outlang.toUpperCase()
          })
        });
        
        if (!response.ok) {
          if (response.status === 403) {
            sendResponse({ success: false, text: "DeepLのAPIキーが無効です。" });
            return;
          }
          sendResponse({ success: false, text: `翻訳に失敗しました: ${response.status}` });
          return;
        }
        
        const data = await response.json();
        sendResponse({ success: true, text: data.translations[0].text });
      } catch (e) {
        console.error("DeepL翻訳エラー:", e);
        sendResponse({ success: false, text: "通信エラーが発生しました。" });
      }
    })();

    return true; 
  }
});