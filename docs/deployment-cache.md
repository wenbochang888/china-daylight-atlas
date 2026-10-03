# 版本化资源缓存与 gzip

适用于本项目静态产物；入口示例为 `https://www.gdufe888.top/sun/`，目录为 `/root/work/workspace/china-daylight-atlas/dist/`。本轮只交付配置，没有修改线上服务器。

## Nginx 配置

在提供本项目的 `server` 中使用下列配置。如果已有同名 location，替换对应配置，不重复添加。HTTP 和 HTTPS 如分别直接提供网站，两处均应用；其他网站的 location 保持原样。

```nginx
location = /sun {
    return 301 /sun/$is_args$args;
}

# Vite 所有构建资源均有内容哈希；内容改变后使用新的文件名。
location ^~ /sun/assets/ {
    alias /root/work/workspace/china-daylight-atlas/dist/assets/;
    autoindex off;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# HTML 必须检查更新；缺失资源直接返回 404，不回退成 HTML。
location ^~ /sun/ {
    alias /root/work/workspace/china-daylight-atlas/dist/;
    index index.html;
    autoindex off;
    add_header Cache-Control "no-cache";
}

gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 5;
gzip_types application/javascript text/javascript text/css application/json;
```

`gzip` 指令可放在上述 server，或统一放在 http 层；已有配置时合并，避免在同一层重复声明。Nginx 自动包含 HTML 压缩。MP3 使用原有媒体响应与 Range 支持，不额外 gzip。保留现有 `mime.types`，确保 JS、CSS、JSON 和 MP3 返回正确类型。

## 应用与检查

先完成生产构建并更新产物，再备份、编辑 Nginx 配置。以下命令由维护者在服务器上执行，本轮没有执行：

```sh
cp -p /usr/local/nginx/conf/nginx.conf /usr/local/nginx/conf/nginx.conf.bak-sun-cache
/usr/local/nginx/sbin/nginx -t -c /usr/local/nginx/conf/nginx.conf
```

只有配置校验成功才执行重载：

```sh
/usr/local/nginx/sbin/nginx -s reload -c /usr/local/nginx/conf/nginx.conf
```

- `/sun` 正常跳转 `/sun/`，HTML 响应为 `Cache-Control: no-cache`。
- 从实际 HTML 找到 `assets/national-map-<hash>.js`；检查其响应为 `public, max-age=31536000, immutable`，带 `Accept-Encoding: gzip` 时返回 `Content-Encoding: gzip` 和 `Vary: Accept-Encoding`。
- 普通刷新或再次导航时，浏览器复用未过期的哈希资源。强制刷新可能绕过缓存，不用它验收暖缓存。
- 新构建的 HTML 引用新哈希文件；发布时保证 HTML 和其引用的资源同时可用。按现有静态部署流程更新，不覆盖成未带哈希的同名资源。
- 本轮本机性能检查使用相同缓存和压缩规则，命令为 `node scripts/startup-check.mjs`。本机测量不能代表线上服务器、真实带宽或真机结果。

这不是整站离线缓存。首次访问仍需网络，浏览器清除或回收缓存后需要重新下载。
