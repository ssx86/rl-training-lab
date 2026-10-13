param(
  [ValidateSet("vathorst", "milton-keynes", "houten")]
  [string]$CityId = "vathorst",
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$profiles = @{
  "vathorst" = @{ name = "真实街区 · Vathorst"; constant = "OSM_VATHORST_CITY"; west = 5.426; south = 52.191; east = 5.438; north = 52.198; center = "52.1945/5.4320" }
  "milton-keynes" = @{ name = "环岛新区 · Milton Keynes"; constant = "OSM_MILTON_KEYNES_CITY"; west = -0.770; south = 52.035; east = -0.758; north = 52.042; center = "52.0385/-0.7640" }
  "houten" = @{ name = "巷道城区 · Houten"; constant = "OSM_HOUTEN_CITY"; west = 5.152; south = 52.025; east = 5.164; north = 52.032; center = "52.0285/5.1580" }
}
$profile = $profiles[$CityId]
$bbox = @{ west = $profile.west; south = $profile.south; east = $profile.east; north = $profile.north }
$OutputPath = if ($OutputPath) { $OutputPath } else { "src/driving/osm-$CityId.generated.ts" }
$meanLatitude = ($bbox.south + $bbox.north) / 2
$metersPerLongitudeDegree = 111320 * [math]::Cos($meanLatitude * [math]::PI / 180)
$metersPerLatitudeDegree = 110540
$paddingMeters = 24
$mapWidthMeters = [math]::Round((($bbox.east - $bbox.west) * $metersPerLongitudeDegree) + 2 * $paddingMeters, 2)
$mapHeightMeters = [math]::Round((($bbox.north - $bbox.south) * $metersPerLatitudeDegree) + 2 * $paddingMeters, 2)
$sourceUrl = "https://www.openstreetmap.org/export#map=16/$($profile.center)"
$apiUrl = "https://api.openstreetmap.org/api/0.6/map?bbox=$($bbox.west),$($bbox.south),$($bbox.east),$($bbox.north)"
[xml]$osm = (Invoke-WebRequest -Uri $apiUrl -Headers @{ "User-Agent" = "RLNavigationLab/1.0" }).Content

$nodeById = @{}
foreach ($node in $osm.osm.node) { $nodeById[[string]$node.id] = $node }
$allowed = @("primary", "secondary", "tertiary", "residential", "living_street", "unclassified")
$roadWays = @($osm.osm.way | Where-Object {
  $highway = $_.tag | Where-Object { $_.k -eq "highway" } | Select-Object -First 1
  $highway -and $allowed -contains [string]$highway.v
})

function PointForNode([string]$id) {
  $node = $nodeById[$id]
  # The simulation uses metres. Keep X/Y at the same physical scale so the
  # overview, lidar, collisions and driver camera all share one unit system.
  $x = $paddingMeters + (([double]$node.lon - $bbox.west) * $metersPerLongitudeDegree)
  $y = $paddingMeters + (($bbox.north - [double]$node.lat) * $metersPerLatitudeDegree)
  return @{ x = [math]::Round($x, 2); y = [math]::Round($y, 2) }
}

$edges = @()
$degree = @{}
$usedNodeIds = [System.Collections.Generic.HashSet[string]]::new()
foreach ($way in $roadWays) {
  $refs = @($way.nd | ForEach-Object { [string]$_.ref })
  $highway = [string](($way.tag | Where-Object { $_.k -eq "highway" } | Select-Object -First 1).v)
  $roundabout = [bool]($way.tag | Where-Object { $_.k -eq "junction" -and $_.v -eq "roundabout" })
  $oneWayTag = [string](($way.tag | Where-Object { $_.k -eq "oneway" } | Select-Object -First 1).v)
  $oneWay = $roundabout -or @("yes", "1", "true") -contains $oneWayTag
  $reverseOneWay = $oneWayTag -eq "-1"
  for ($index = 0; $index -lt $refs.Count - 1; $index += 1) {
    $from = if ($reverseOneWay) { $refs[$index + 1] } else { $refs[$index] }
    $to = if ($reverseOneWay) { $refs[$index] } else { $refs[$index + 1] }
    $null = $usedNodeIds.Add($from); $null = $usedNodeIds.Add($to)
    $degree[$from] = 1 + ($degree[$from] ?? 0); $degree[$to] = 1 + ($degree[$to] ?? 0)
    $edges += @{ from = $from; to = $to; roadClass = $highway; roundabout = $roundabout; oneWay = $oneWay }
  }
}

# Keep the largest strongly connected road component so every generated taxi
# order remains reachable while respecting OSM one-way and roundabout direction.
$adjacency = @{}
$reverseAdjacency = @{}
foreach ($edge in $edges) {
  if (-not $adjacency[$edge.from]) { $adjacency[$edge.from] = @() }
  if (-not $adjacency[$edge.to]) { $adjacency[$edge.to] = @() }
  if (-not $reverseAdjacency[$edge.from]) { $reverseAdjacency[$edge.from] = @() }
  if (-not $reverseAdjacency[$edge.to]) { $reverseAdjacency[$edge.to] = @() }
  $adjacency[$edge.from] += $edge.to
  $reverseAdjacency[$edge.to] += $edge.from
  if (-not $edge.oneWay) {
    $adjacency[$edge.to] += $edge.from
    $reverseAdjacency[$edge.from] += $edge.to
  }
}

function Reachable([string]$start, $graph) {
  $visited = [System.Collections.Generic.HashSet[string]]::new()
  $queue = [System.Collections.Generic.Queue[string]]::new()
  $null = $visited.Add($start); $queue.Enqueue($start)
  while ($queue.Count) {
    $current = $queue.Dequeue()
    foreach ($next in $graph[$current]) { if ($visited.Add([string]$next)) { $queue.Enqueue([string]$next) } }
  }
  return $visited
}

$remaining = [System.Collections.Generic.HashSet[string]]::new([string[]]$usedNodeIds)
$largest = @()
while ($remaining.Count) {
  $start = $remaining | Select-Object -First 1
  $forward = Reachable $start $adjacency
  $backward = Reachable $start $reverseAdjacency
  $component = @($forward | Where-Object { $backward.Contains($_) })
  foreach ($nodeId in $component) { $null = $remaining.Remove($nodeId) }
  if ($component.Count -gt $largest.Count) { $largest = $component }
}
$largestSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$largest)
$edges = @($edges | Where-Object { $largestSet.Contains($_.from) -and $largestSet.Contains($_.to) })
$nodes = @($largest | ForEach-Object {
  $point = PointForNode $_
  $label = if ($degree[$_] -eq 1) { "街巷尽头" } elseif ($degree[$_] -ge 3) { "城市路口" } else { "道路节点" }
  @{ id = $_; x = $point.x; y = $point.y; label = $label }
})
$roads = @()
foreach ($way in $roadWays) {
  $points = @($way.nd | ForEach-Object {
    $id = [string]$_.ref
    if ($nodeById[$id]) { PointForNode $id }
  })
  if ($points.Count -lt 2) { continue }
  $highway = [string](($way.tag | Where-Object { $_.k -eq "highway" } | Select-Object -First 1).v)
  $roundabout = [bool]($way.tag | Where-Object { $_.k -eq "junction" -and $_.v -eq "roundabout" })
  $roads += @{ id = [string]$way.id; points = $points; roadClass = $highway; roundabout = $roundabout }
}
$destinations = @($largest | Where-Object { $degree[$_] -eq 1 -or $degree[$_] -ge 3 } | Select-Object -First 48)

$objects = @()
$buildingIndex = 0
foreach ($way in $osm.osm.way) {
  if (-not ($way.tag | Where-Object { $_.k -eq "building" })) { continue }
  $points = @($way.nd | ForEach-Object { if ($nodeById[[string]$_.ref]) { PointForNode ([string]$_.ref) } })
  if (-not $points.Count) { continue }
  $x = ($points | Measure-Object x -Average).Average; $y = ($points | Measure-Object y -Average).Average
  $minX = ($points | Measure-Object x -Minimum).Minimum; $maxX = ($points | Measure-Object x -Maximum).Maximum
  $minY = ($points | Measure-Object y -Minimum).Minimum; $maxY = ($points | Measure-Object y -Maximum).Maximum
  $footprintSize = [math]::Max(5, [math]::Min(18, ((($maxX - $minX) + ($maxY - $minY)) / 2)))
  if ($x -ge 12 -and $x -le ($mapWidthMeters - 12) -and $y -ge 12 -and $y -le ($mapHeightMeters - 12) -and $buildingIndex % 3 -eq 0) {
    $objects += @{ id = "osm-building-$buildingIndex"; kind = "building"; x = [math]::Round($x, 2); y = [math]::Round($y, 2); size = [math]::Round($footprintSize, 2) }
  }
  $buildingIndex += 1
  if ($objects.Count -ge 140) { break }
}

$city = [ordered]@{
  id = "osm-$CityId"
  name = $profile.name
  width = $mapWidthMeters
  height = $mapHeightMeters
  roadWidth = 7
  renderRoadWidth = 6.5
  nodes = $nodes
  edges = $edges
  roads = $roads
  objects = $objects
  destinationNodeIds = $destinations
  attribution = "Map data © OpenStreetMap contributors · ODbL"
  sourceUrl = $sourceUrl
}
$json = $city | ConvertTo-Json -Depth 8 -Compress
$content = @"
// Generated from OpenStreetMap data by scripts/import-osm-city.ps1.
// Data © OpenStreetMap contributors, available under ODbL: https://www.openstreetmap.org/copyright
import type { CityMap } from "./city-map";
export const $($profile.constant) = $json as const satisfies CityMap;
"@
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $OutputPath), $content, [System.Text.UTF8Encoding]::new($false))
Write-Output "Generated $OutputPath with $($nodes.Count) road nodes, $($edges.Count) road segments, $($roads.Count) continuous roads, $($objects.Count) buildings, and $($destinations.Count) taxi destinations."
