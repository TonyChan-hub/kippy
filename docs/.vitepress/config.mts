import { defineConfig } from 'vitepress'

const repo = 'https://github.com/TonyChan-hub/kippy'
const npmRn = 'https://www.npmjs.com/package/@bear1210/create-rn-template'
const npmFlutter = 'https://www.npmjs.com/package/@bear1210/create-flutter-template'

export default defineConfig({
  title: 'Kippy',
  description: 'Business-free React Native & Flutter scaffolds, plus macOS mobile toolchain helpers.',
  base: '/kippy/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/kippy/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#1f3d34' }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'Kippy',
      description:
        'Business-free React Native & Flutter scaffolds, plus macOS mobile toolchain helpers.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'React Native', link: '/guide/create-rn' },
          { text: 'Flutter', link: '/guide/create-flutter' },
          { text: 'NativeKit', link: '/guide/native-kit/' },
          { text: 'Blog', link: '/blog/' },
          { text: 'Download Zippy', link: '/guide/zippy#download' },
          {
            text: 'npm',
            items: [
              { text: 'create-rn-template', link: npmRn },
              { text: 'create-flutter-template', link: npmFlutter },
            ],
          },
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Introduction',
              items: [
                { text: 'What is Kippy?', link: '/guide/getting-started' },
                { text: 'Packages', link: '/guide/packages' },
              ],
            },
            {
              text: 'CLI',
              items: [
                { text: 'Create React Native app', link: '/guide/create-rn' },
                { text: 'Create Flutter app', link: '/guide/create-flutter' },
                { text: 'Setup Android / iOS env', link: '/guide/env-setup' },
                { text: 'Check mobile environment', link: '/guide/check-env' },
              ],
            },
            {
              text: 'Templates',
              items: [
                { text: 'RN template features', link: '/guide/rn-template' },
                { text: 'Flutter template features', link: '/guide/flutter-template' },
              ],
            },
            {
              text: 'Toolkit',
              items: [
                { text: 'Zippy inspector', link: '/guide/zippy' },
              ],
            },
            {
              text: 'NativeKit (Beta)',
              collapsed: false,
              items: [
                { text: 'Overview', link: '/guide/native-kit/' },
                { text: 'Install', link: '/guide/native-kit/install' },
                { text: 'Permission API', link: '/guide/native-kit/permission' },
                { text: 'Device API', link: '/guide/native-kit/device' },
                { text: 'Platform declarations', link: '/guide/native-kit/platform' },
              ],
            },
          ],
          '/blog/': [
            {
              text: 'Blog',
              items: [
                { text: 'All posts', link: '/blog/' },
                {
                  text: 'Zippy 0.0.6: in-app auto-update',
                  link: '/blog/zippy-auto-update',
                },
                {
                  text: 'Why Zippy (vs Flipper & others)',
                  link: '/blog/why-zippy',
                },
                {
                  text: 'Env helper on a new Mac',
                  link: '/blog/env-helper-new-mac',
                },
                {
                  text: 'SQLite: offline & optimistic updates',
                  link: '/blog/sqlite-offline-optimistic',
                },
                {
                  text: 'Permission status (Android / iOS)',
                  link: '/blog/permission-status',
                },
                {
                  text: 'Zippy APK Playground',
                  link: '/blog/zippy-apk-playground',
                },
                {
                  text: 'Quick scaffold: three media permissions',
                  link: '/blog/quick-scaffold-media',
                },
                {
                  text: 'NativeKit: permission facade',
                  link: '/blog/native-kit-permissions',
                },
              ],
            },
          ],
        },
        editLink: {
          pattern: `${repo}/edit/main/docs/:path`,
          text: 'Edit this page on GitHub',
        },
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © Kippy contributors',
        },
      },
    },
    zh: {
      label: '中文',
      lang: 'zh-CN',
      title: 'Kippy',
      description: '无业务逻辑的 React Native / Flutter 脚手架，以及 macOS 移动端环境工具。',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: 'React Native', link: '/zh/guide/create-rn' },
          { text: 'Flutter', link: '/zh/guide/create-flutter' },
          { text: 'NativeKit', link: '/zh/guide/native-kit/' },
          { text: '博客', link: '/zh/blog/' },
          { text: '下载 Zippy', link: '/zh/guide/zippy#download' },
          {
            text: 'npm',
            items: [
              { text: 'create-rn-template', link: npmRn },
              { text: 'create-flutter-template', link: npmFlutter },
            ],
          },
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '介绍',
              items: [
                { text: '什么是 Kippy？', link: '/zh/guide/getting-started' },
                { text: '包一览', link: '/zh/guide/packages' },
              ],
            },
            {
              text: '命令行',
              items: [
                { text: '创建 RN 项目', link: '/zh/guide/create-rn' },
                { text: '创建 Flutter 项目', link: '/zh/guide/create-flutter' },
                { text: '配置 Android / iOS 环境', link: '/zh/guide/env-setup' },
                { text: '检查移动端环境', link: '/zh/guide/check-env' },
              ],
            },
            {
              text: '模板能力',
              items: [
                { text: 'RN 模板功能', link: '/zh/guide/rn-template' },
                { text: 'Flutter 模板功能', link: '/zh/guide/flutter-template' },
              ],
            },
            {
              text: '工具',
              items: [
                { text: 'Zippy 调试器', link: '/zh/guide/zippy' },
              ],
            },
            {
              text: 'NativeKit（Beta）',
              collapsed: false,
              items: [
                { text: '概览', link: '/zh/guide/native-kit/' },
                { text: '接入', link: '/zh/guide/native-kit/install' },
                { text: 'Permission API', link: '/zh/guide/native-kit/permission' },
                { text: 'Device API', link: '/zh/guide/native-kit/device' },
                { text: '平台声明', link: '/zh/guide/native-kit/platform' },
              ],
            },
          ],
          '/zh/blog/': [
            {
              text: '技术博客',
              items: [
                { text: '全部文章', link: '/zh/blog/' },
                {
                  text: 'Zippy 0.0.6：应用内自动更新',
                  link: '/zh/blog/zippy-auto-update',
                },
                {
                  text: '为什么要有 Zippy',
                  link: '/zh/blog/why-zippy',
                },
                {
                  text: '环境助手：全新 Mac 开箱',
                  link: '/zh/blog/env-helper-new-mac',
                },
                {
                  text: 'SQLite：弱网与乐观更新',
                  link: '/zh/blog/sqlite-offline-optimistic',
                },
                {
                  text: '权限 status 含义（Android / iOS）',
                  link: '/zh/blog/permission-status',
                },
                {
                  text: 'Zippy APK Playground 使用说明',
                  link: '/zh/blog/zippy-apk-playground',
                },
                {
                  text: '快速搭建：三种媒体权限',
                  link: '/zh/blog/quick-scaffold-media',
                },
                {
                  text: 'NativeKit：双端权限门面',
                  link: '/zh/blog/native-kit-permissions',
                },
              ],
            },
          ],
        },
        editLink: {
          pattern: `${repo}/edit/main/docs/:path`,
          text: '在 GitHub 上编辑此页',
        },
        footer: {
          message: '基于 MIT 协议发布。',
          copyright: 'Copyright © Kippy contributors',
        },
        outlineTitle: '本页目录',
        lastUpdatedText: '最后更新',
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色',
        darkModeSwitchTitle: '切换到深色',
        returnToTopLabel: '回到顶部',
        sidebarMenuLabel: '菜单',
      },
    },
  },

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Kippy' },
    socialLinks: [{ icon: 'github', link: repo }],
    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: { buttonText: '搜索', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '无结果',
                resetButtonTitle: '清除',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                },
              },
            },
          },
        },
      },
    },
  },
})
