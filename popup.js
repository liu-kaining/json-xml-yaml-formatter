/**
 * 超级格式化工具核心逻辑
 * 版本：v2025.1.31-UI
 * 开发者：liqian_liukaining
 * 最后更新：2025-01-31
 */

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  // 元素引用
  const DOM = {
    formatType: document.getElementById('formatType'),
    input: document.getElementById('input'),
    formatBtn: document.getElementById('formatBtn'),
    convertBtn: document.getElementById('convertBtn'),
    output: document.getElementById('output'),
    copyBtn: document.getElementById('copyBtn'),
    errorDiv: document.getElementById('error'),
    errorLine: document.querySelector('.error-line')
  };

  // 状态初始化
  let lastValidContent = '';
  
  // 事件监听
  DOM.formatBtn.addEventListener('click', handleFormat);
  DOM.convertBtn.addEventListener('click', handleConvert);
  DOM.copyBtn.addEventListener('click', handleCopy);
  DOM.input.addEventListener('input', debounce(validateInput, 500));
  
  // 加载用户偏好
  loadPreferences();

  /**
   * 加载用户设置
   */
  function loadPreferences() {
    chrome.storage.local.get(['lastFormat', 'lastInput'], data => {
      if (data.lastFormat) DOM.formatType.value = data.lastFormat;
      if (data.lastInput) DOM.input.value = data.lastInput;
    });
  }

  /**
   * 格式化处理
   */
  async function handleFormat() {
    const content = DOM.input.value.trim();
    if (!content) return;

    try {
      // 保存状态
      chrome.storage.local.set({
        lastFormat: DOM.formatType.value,
        lastInput: content
      });

      // 执行格式化
      const formatted = formatContent(content, DOM.formatType.value);
      displayResult(formatted);
      lastValidContent = content;
    } catch (err) {
      handleError(err);
    }
  }

  /**
   * 格式转换
   */
  function handleConvert() {
    try {
      const content = DOM.input.value.trim();
      let converted;
      
      if (DOM.formatType.value === 'json') {
        converted = jsyaml.dump(JSON.parse(content));
        DOM.formatType.value = 'yaml';
      } else {
        converted = JSON.stringify(jsyaml.load(content), null, 2);
        DOM.formatType.value = 'json';
      }
      
      DOM.input.value = converted;
      handleFormat();
    } catch (err) {
      handleError(err);
    }
  }

  /**
   * 输入校验
   */
  function validateInput() {
    try {
      clearErrors();
      const content = DOM.input.value.trim();
      if (!content) return;

      switch (DOM.formatType.value) {
        case 'json':
          JSON.parse(content);
          break;
        case 'xml':
          validateXML(content);
          break;
        case 'yaml':
          jsyaml.load(content);
          break;
      }
    } catch (err) {
      showValidationError(err);
    }
  }

  /**
   * XML校验
   */
  function validateXML(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    if (doc.documentElement.nodeName === "parsererror") {
      throw new Error('XML解析错误: ' + doc.documentElement.textContent);
    }
  }

  /**
   * 显示错误
   */
  function showValidationError(err) {
    DOM.input.classList.add('has-error');
    DOM.errorLine.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      错误行号: ${parseLineNumber(err) || '未知'}
    `;
    DOM.errorLine.style.display = 'flex';
    DOM.errorDiv.textContent = `校验失败: ${cleanErrorMessage(err.message)}`;
    DOM.errorDiv.style.display = 'block';
  }

  /**
   * 清除错误状态
   */
  function clearErrors() {
    DOM.input.classList.remove('has-error');
    DOM.errorLine.style.display = 'none';
    DOM.errorDiv.style.display = 'none';
  }

  /**
   * 解析错误行号
   */
  function parseLineNumber(err) {
    const match = err.stack.match(/at position (\d+)/) 
      || err.message.match(/line (\d+)/);
    return match ? match[1] : null;
  }

  /**
   * 清理错误信息
   */
  function cleanErrorMessage(msg) {
    return msg
      .replace(/^[^:]+:/, '')
      .replace(/at\s+.*/, '')
      .trim();
  }

  /**
   * 格式化内容
   */
  function formatContent(content, type) {
    switch (type) {
      case 'json':
        return JSON.stringify(JSON.parse(content), null, 2);
      case 'xml':
        return formatXML(content);
      case 'yaml':
        return jsyaml.dump(jsyaml.load(content));
      default:
        throw new Error('不支持的格式类型');
    }
  }

  /**
   * XML格式化
   */
  function formatXML(xml) {
    const PADDING = '  ';
    let formatted = '';
    let indent = '';
    let inComment = false;

    xml = xml
      .replace(/<!--[\s\S]*?-->/g, m => m.replace(/\n/g, ' '))
      .replace(/>\s+</g, '><');

    xml.split(/(<[^>]+>)/).forEach(node => {
      if (!node) return;

      if (node.startsWith('<!--')) inComment = true;
      if (inComment) {
        formatted += indent + node + '\n';
        if (node.endsWith('-->')) inComment = false;
        return;
      }

      if (node.startsWith('</')) indent = indent.slice(0, -PADDING.length);
      formatted += indent + node + '\n';
      if (!node.startsWith('</') && !node.endsWith('/>') && !/<\?/.test(node)) {
        indent += PADDING;
      }
    });

    return formatted.trim();
  }

  /**
   * 显示结果
   */
  function displayResult(content) {
    DOM.output.innerHTML = hljs.highlight(content, { 
      language: DOM.formatType.value 
    }).value;
    DOM.copyBtn.disabled = false;
  }

  /**
   * 复制结果
   */
  function handleCopy() {
    navigator.clipboard.writeText(DOM.output.textContent)
      .then(() => {
        DOM.copyBtn.textContent = '已复制!';
        setTimeout(() => {
          DOM.copyBtn.textContent = '复制结果';
        }, 2000);
      })
      .catch(err => {
        DOM.errorDiv.textContent = `复制失败: ${err.message}`;
        DOM.errorDiv.style.display = 'block';
      });
  }

  /**
   * 防抖函数
   */
  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }
}