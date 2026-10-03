<?php

/**
 * @file
 * Creates the demo's media and articles. Run with: drush php:script.
 *
 * Images are generated with GD so the demo has no binary assets and the
 * screenshots are identical on every install.
 */

declare(strict_types=1);

use Drupal\Core\File\FileExists;
use Drupal\Core\File\FileSystemInterface;
use Drupal\media\Entity\Media;
use Drupal\node\Entity\Node;

$images = [
  ['Harbour at dawn', [29, 53, 87], [168, 197, 230]],
  ['Red door', [200, 16, 46], [255, 214, 214]],
  ['Forest path', [34, 87, 52], [180, 220, 170]],
  ['Desert dunes', [214, 152, 72], [250, 230, 190]],
  ['Night city', [20, 20, 40], [120, 90, 200]],
  ['Glacier', [200, 230, 245], [70, 130, 180]],
  ['Lavender field', [120, 80, 160], [230, 210, 245]],
  ['Lemon grove', [240, 210, 40], [90, 140, 40]],
  ['Slate roof', [80, 90, 100], [190, 195, 200]],
  ['Coral reef', [255, 120, 90], [40, 160, 170]],
  ['Autumn maple', [180, 70, 20], [250, 180, 60]],
  ['Morning fog', [220, 220, 215], [150, 150, 145]],
];

$directory = 'public://demo';
\Drupal::service('file_system')->prepareDirectory($directory, FileSystemInterface::CREATE_DIRECTORY);

$media_ids = [];
foreach ($images as $i => [$name, $from, $to]) {
  $existing = \Drupal::entityTypeManager()->getStorage('media')->loadByProperties(['name' => $name]);
  if ($existing) {
    $media_ids[] = reset($existing)->id();
    continue;
  }
  $w = 800;
  $h = 600;
  $im = imagecreatetruecolor($w, $h);
  for ($y = 0; $y < $h; $y++) {
    $t = $y / $h;
    $c = imagecolorallocate($im,
      (int) ($from[0] + ($to[0] - $from[0]) * $t),
      (int) ($from[1] + ($to[1] - $from[1]) * $t),
      (int) ($from[2] + ($to[2] - $from[2]) * $t));
    imageline($im, 0, $y, $w, $y, $c);
  }
  // A simple shape per image, so thumbnails are distinguishable.
  $shape = imagecolorallocatealpha($im, 255, 255, 255, 70);
  match ($i % 3) {
    0 => imagefilledellipse($im, 560, 220, 260, 260, $shape),
    1 => imagefilledrectangle($im, 120, 300, 420, 540, $shape),
    2 => imagefilledpolygon($im, [100, 520, 400, 120, 700, 520], $shape),
  };
  $path = "$directory/demo-" . ($i + 1) . '.jpg';
  ob_start();
  imagejpeg($im, NULL, 85);
  $data = ob_get_clean();
  $file = \Drupal::service('file.repository')->writeData($data, $path, FileExists::Replace);
  $file->setPermanent();
  $file->save();

  $media = Media::create([
    'bundle' => 'image',
    'name' => $name,
    'uid' => 1,
    'field_media_image' => ['target_id' => $file->id(), 'alt' => $name],
  ]);
  $media->save();
  $media_ids[] = $media->id();
}

$articles = [
  ['A contract, not a theme', [0, 1, 2]],
  ['One module, every theme', [3, 4]],
];
foreach ($articles as [$title, $refs]) {
  if (\Drupal::entityTypeManager()->getStorage('node')->loadByProperties(['title' => $title])) {
    continue;
  }
  $node = Node::create([
    'type' => 'article',
    'title' => $title,
    'uid' => 1,
    'status' => 1,
    'promote' => 1,
    'field_media' => array_map(fn ($k) => ['target_id' => $media_ids[$k]], $refs),
  ]);
  $node->save();
  $node->addTranslation('ar', [
    'title' => 'عقد، وليس قالبًا ' . $node->id(),
    'field_media' => $node->get('field_media')->getValue(),
  ])->save();
}

echo count($media_ids) . " media items, " . count($articles) . " articles.\n";
