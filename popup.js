/**
 * 数据格式化工具核心逻辑
 * 作者：liqian_liukaining
 * 版本：v2025.1.31
 * 最后更新：2025-01-31
 */
/* 在popup.css顶部添加 */
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&display=swap');
document.addEventListener('DOMContentLoaded', initExtension);

function initExtension() {
  // DOM元素引用
  const formatType = document.getElementById('formatType');
  const input = document.getElementById('input');
  const formatBtn = document.getElementById('formatBtn');
  const convertBtn = document.getElementById('convertBtn');
  const output = document.getElementById('output');
  const copyBtn = document.getElementById('copyBtn');
  const errorDiv = document.getElementById('error');

  // 加载用户偏好设置
  loadUserPreferences();

  // 事件监听
  formatBtn.addEventListener('click', handleFormat);
  convertBtn.addEventListener('click', handleConvert);
  copyBtn.addEventListener('click', handleCopy);

  /**
   * 加载用户保存的偏好设置
   */
  function loadUserPreferences() {
    chrome.storage.local.get(['lastFormat', 'lastInput'], (data) => {
      if (data.lastFormat) formatType.value = data.lastFormat;
      if (data.lastInput) input.value = data.lastInput;
    });
  }

  /**
   * 格式化处理主函数
   */
  async function handleFormat() {
    const text = input.value.trim();
    if (!text) return;

    try {
      // 保存当前状态
      chrome.storage.local.set({
        lastFormat: formatType.value,
        lastInput: text
      });

      // 执行格式化
      const formatted = formatContent(text, formatType.value);
      displayResult(formatted);
    } catch (err) {
      handleError(err);
    }
  }

  /**
   * 格式转换处理
   */
  function handleConvert() {
    const text = input.value.trim();
    if (!text) return;

    try {
      let converted;
      if (formatType.value === 'json') {
        converted = jsyaml.dump(JSON.parse(text));
        formatType.value = 'yaml';
      } else {
        converted = JSON.stringify(jsyaml.load(text), null, 2);
        formatType.value = 'json';
      }
      input.value = converted;
      handleFormat(); // 自动触发格式化
    } catch (err) {
      handleError(err);
    }
  }

  /**
   * 内容格式化核心方法
   */
  function formatContent(text, type) {
    switch (type) {
      case 'json':
        return JSON.stringify(JSON.parse(text), null, 2);
      
      case 'xml':
        return formatXML(text);
      
      case 'yaml':
        return jsyaml.dump(jsyaml.load(text));
      
      default:
        throw new Error('不支持的格式类型');
    }
  }

  /**
   * XML格式化专用方法
   */
  function formatXML(xml) {
    const PADDING = '  ';
    let formatted = '';
    let indent = '';
    let inComment = false;

    // 预处理
    xml = xml
      .replace(/<!--[\s\S]*?-->/g, m => m.replace(/\n/g, ' '))
      .replace(/>\s+</g, '><');

    xml.split(/(<[^>]+>)/).forEach(node => {
      if (!node) return;

      // 处理注释块
      if (node.startsWith('<!--')) inComment = true;
      if (inComment) {
        formatted += indent + node + '\n';
        if (node.endsWith('-->')) inComment = false;
        return;
      }

      // 调整缩进
      if (node.startsWith('</')) indent = indent.slice(0, -PADDING.length);
      formatted += indent + node + '\n';
      if (!node.startsWith('</') && !node.endsWith('/>') && !/<\?/.test(node)) {
        indent += PADDING;
      }
    });

    return formatted.trim();
  }

  /**
   * 结果展示处理
   */
  function displayResult(content) {
    errorDiv.textContent = '';
    output.innerHTML = hljs.highlight(content, { 
      language: formatType.value 
    }).value;
    copyBtn.disabled = false;
  }

  /**
   * 错误处理
   */
  function handleError(err) {
    const cleanError = err.message.replace(/^[^:]+:/, '').trim();
    errorDiv.textContent = `错误：${cleanError}`;
    output.textContent = '';
    copyBtn.disabled = true;
    console.error(`[Formatter Error] ${err.stack}`);
  }

  /**
   * 复制结果到剪贴板
   */
  function handleCopy() {
    navigator.clipboard.writeText(output.textContent)
      .then(() => {
        copyBtn.textContent = '已复制!';
        setTimeout(() => {
          copyBtn.textContent = '复制';
        }, 2000);
      })
      .catch(err => {
        errorDiv.textContent = `复制失败：${err.message}`;
      });
  }

  /**
 * 实时语法校验
 */
function setupLiveValidation() {
  let timeout;
  
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      validateSyntax(input.value);
    }, 500);
  });
}

/**
 * 语法校验核心方法
 */
function validateSyntax(text) {
  try {
    // 清除旧错误标记
    input.classList.remove('has-error');
    document.querySelector('.error-line').style.display = 'none';
    
    // 空内容跳过校验
    if (!text.trim()) return;

    // 根据当前格式进行校验
    switch (formatType.value) {
      case 'json':
        JSON.parse(text);
        break;
      case 'xml':
        validateXML(text);
        break;
      case 'yaml':
        jsyaml.load(text);
        break;
    }
    
    // 校验成功
    errorDiv.style.display = 'none';
  } catch (err) {
    // 显示错误标记
    input.classList.add('has-error');
    showErrorMarker(err);
    errorDiv.textContent = `语法错误：${cleanErrorMessage(err.message)}`;
    errorDiv.style.display = 'block';
  }
}

/**
 * XML专用校验
 */
function validateXML(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error('无效的XML结构');
  }
}

/**
 * 显示错误行标记
 */
function showErrorMarker(err) {
  const errorLine = document.querySelector('.error-line');
  const lineNumber = getErrorLineNumber(err);
  
  errorLine.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
    第 ${lineNumber} 行
  `;
  errorLine.style.display = 'flex';
}

/**
 * 解析错误行号
 */
function getErrorLineNumber(err) {
  const match = err.stack.match(/at position (\d+)/) 
    || err.message.match(/line (\d+)/);
  return match ? match[1] : '未知';
}

}