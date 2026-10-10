# 项目结构说明

```text
exam-clock/
├── assets/
│   ├── fonts/iconfont/         # 本地图标字体及演示资源
│   └── images/favicon.png      # 网站与 PWA 图标
├── css/
│   └── styles.css              # 全站样式、响应式布局与组件样式
├── js/
│   ├── script.js               # 首页计时、官方预设、收藏和显示设置
│   └── custom-exam.js          # 自定义考试的编辑、排序、保存与应用
├── scripts/
│   ├── .env.example            # 部署脚本所需环境变量示例
│   └── deploy.sh               # 面向 Nginx 服务器的可选部署脚本
├── index.html                  # 主模拟器与官方预设市场
├── custom-exam.html            # 自定义考试配置页
├── introduction.html           # 功能介绍页
├── design.html                 # 设计规范展示页
├── manifest.json               # PWA Web App Manifest
├── sw.js                       # Service Worker 缓存逻辑
├── README.md                   # 项目说明与上手指南
├── CONTRIBUTING.md             # 贡献指南
├── SECURITY.md                 # 安全问题报告方式
└── LICENSE                     # MIT 许可证
```

## 关键模块

### 首页与预设

`index.html` 负责页面结构；`js/script.js` 包含 CET、高考等内置预设、考试计时、环节跳转、官方预设市场、收藏和显示设置。需要新增或调整官方预设时，应同时检查 `officialPresetCategories` 与 `officialExams`，确保分类和数据保持一致。

### 自定义考试

`custom-exam.html` 与 `js/custom-exam.js` 提供配置编辑器。配置、收藏及显示偏好保存在浏览器 `localStorage`，不依赖服务器或数据库。

### 离线与资源

`manifest.json` 定义安装后的应用元数据，`sw.js` 预缓存本地静态资源并在运行时缓存同源资源与字体资源。更改离线资源清单时，应相应更新缓存版本号，确保已安装用户能收到新文件。

### 部署

`scripts/deploy.sh` 是可选的服务器部署脚本，使用前复制 `scripts/.env.example` 为 `scripts/.env` 并在本机填写配置。`scripts/.env` 及服务器专用资料不应提交到仓库。
