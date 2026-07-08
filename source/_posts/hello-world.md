---
title: GitHub Pages博客作业记录
date: 2026-07-03 20:46:00
tags: 博客作业
---
# Hexo+GitHub Pages 博客作业完整记录
## 一、操作流程
1. 在GitHub创建公开仓库 di1687.github.io
2. 本地使用hexo init搭建纯净Hexo博客
3. 通过git命令将源码推送至远程仓库
4. 配置GitHub Actions自动流水线，实现一键部署
5. 访问 https://di1687.github.io 查看发布后的博客网站

## 二、踩坑问题记录
1. 本地默认分支master，远程仓库分支main，推送代码失败，执行`git branch -m master main`改名解决
2. 之前手动克隆主题产生子模块，流水线构建报错，全新初始化后自带完整主题，规避该问题
3. 缺少Actions配置文件，访问域名出现404页面，新建deploy.yml流水线文件自动构建发布

## 三、工具使用总结
1. Git：完成本地代码与远程仓库同步
2. Markdown：编写博客文章，支持标题、列表等格式
3. GitHub Actions：自动打包、生成静态网站并发布
4. GitHub Pages：提供免费静态网站访问地址