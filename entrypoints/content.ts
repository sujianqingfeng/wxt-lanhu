export default defineContentScript({
  matches: ['*://lanhuapp.com/web/*'],
  main() {
    // 方案 A 不依赖页面脚本；预留入口给后续“点选/高亮”等增强。
  },
});
