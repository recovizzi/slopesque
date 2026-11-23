#!/bin/sh
# On the machine, as the deploy account: the reverse proxy (Caddy, in a container) seen and Slopesque's site added.
#   sh caddy.sh check  <dir>                 what Caddy serves: its container, its network, each site and its upstream —
#                                            a container's name on its network, or not (an address, a missing container)
#   sh caddy.sh network <dir> <env-file>     PROXY_NETWORK added to <env-file> when Caddy is on a Docker network (before
#                                            the server starts: it joins that network as « slopesque-server »)
#   sh caddy.sh install <dir> <env-file>     the site read on stdin ({{UPSTREAM}} filled in), checked, Caddy reloaded
# <dir>: the folder of the sites' files (mounted in Caddy's container).
set -eu
cmd=$1 dir=$2
C=$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($2) ~ /caddy/ { print $1; exit }')
[ -n "$C" ] || { echo "✖ aucun conteneur Caddy en marche"; exit 1; }
mode=$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$C")
nets=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$C")
net=$(for n in $nets; do case $n in bridge|host|none) ;; *) echo "$n"; break ;; esac; done)
conf=$(docker inspect -f '{{join .Args " "}}' "$C" | sed -n 's/.*--config \([^ ]*\).*/\1/p'); conf=${conf:-/etc/caddy/Caddyfile}
real=$(cd "$dir" && pwd -P)
mount=$(docker inspect -f '{{range .Mounts}}{{.Source}}|{{.Destination}}{{"\n"}}{{end}}' "$C" | awk -F'|' -v d="$real" 'index(d, $1) == 1 { print $2 substr(d, length($1) + 1); exit }')
ext=$(ls "$dir" | sed -n 's/^[^.]*\(\..*\)$/\1/p' | sort | uniq -c | sort -rn | awk 'NR == 1 { print $2 }')
echo "Caddy : conteneur $C, réseau ${mode} ${net:+(sites joints par $net)}, configuration $conf, sites $dir → ${mount:-pas monté ?}"

if [ "$cmd" = network ]; then
  envf=$3
  if [ -n "$net" ] && ! grep -qE '^PROXY_NETWORK=' "$envf"; then echo "PROXY_NETWORK=$net" >> "$envf"; echo "réseau du proxy ajouté à infra/.env : $net"; fi
  exit 0
fi

if [ "$cmd" = check ]; then
  echo "curl sur la machine : $(command -v curl > /dev/null && echo oui || echo 'NON (le contrôle de santé en a besoin)')"
  names=" $( [ -n "$net" ] && docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' "$net") "
  bad=0
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    site=$(grep -vE '^\s*#' "$f" | grep -E '\{\s*$' | grep -vE '^\s' | head -1 | sed 's/\s*{\s*$//')
    for up in $(grep -vE '^\s*#' "$f" | sed -n 's/^\s*reverse_proxy\s\+\(.*\)$/\1/p' | sed 's/{//' ); do
      host=${up#*://}; host=${host%%:*}
      if printf '%s' "$names" | grep -q " $host "; then echo "  ✓ $(basename "$f") : ${site:-?} → $up (conteneur $host sur $net)";
      else echo "  ✖ $(basename "$f") : ${site:-?} → $up (pas un conteneur nommé sur ${net:-le réseau de Caddy})"; bad=1; fi
    done
  done
  exit 0
fi

if [ "$cmd" = install ]; then
  envf=$3
  if [ -n "$net" ]; then upstream=slopesque-server:23100
  else upstream=127.0.0.1:$(grep -E '^PUBLIC_PORT=' "$envf" | cut -d= -f2); fi
  file="$dir/slopesque${ext:-.caddyfile}"
  old=$(mktemp); [ -f "$file" ] && cp "$file" "$old" || : > "$old"
  sed "s#{{UPSTREAM}}#$upstream#g" > "$file"
  if docker exec "$C" caddy validate --config "$conf" --adapter caddyfile > /dev/null 2>&1 && docker exec "$C" caddy reload --config "$conf" --adapter caddyfile; then
    echo "✓ site Caddy : $file → $upstream, Caddy rechargé"; rm -f "$old"
  else
    echo "✖ Caddy refuse la configuration : site retiré, Caddy inchangé"; docker exec "$C" caddy validate --config "$conf" --adapter caddyfile 2>&1 | tail -5
    if [ -s "$old" ]; then mv "$old" "$file"; else rm -f "$file" "$old"; fi
    exit 1
  fi
fi
