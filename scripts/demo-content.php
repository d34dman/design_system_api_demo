<?php

/**
 * @file
 * Creates the demo's content: Meridian, a magazine about architecture, design
 * and the places people share. Run with: drush php:script.
 *
 * Photos come from assets/demo-photos (see CREDITS.md there), so installs stay
 * offline and the screenshots are identical on every install.
 *
 * Safe to run again, and upgrades an earlier install in place: media items,
 * the first two articles (nodes 1 and 2), the landing page and the Layout
 * Paragraphs page keep their IDs, which the proof scripts use. A node that
 * already has its new title is left alone.
 */

declare(strict_types=1);

use Drupal\Core\Entity\Entity\EntityFormDisplay;
use Drupal\Core\Entity\Entity\EntityViewDisplay;
use Drupal\Core\File\FileExists;
use Drupal\Core\File\FileSystemInterface;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\layout_builder\Entity\LayoutEntityDisplayInterface;
use Drupal\layout_builder\SectionComponent;
use Drupal\media\Entity\Media;
use Drupal\node\Entity\Node;
use Drupal\paragraphs\Entity\Paragraph;
use Drupal\user\Entity\User;

$etm = \Drupal::entityTypeManager();
$at = static fn (string $date): int => (new \DateTimeImmutable($date, new \DateTimeZone('Europe/Berlin')))->getTimestamp();

\Drupal::configFactory()->getEditable('system.site')
  ->set('name', 'Meridian')
  ->set('slogan', 'Architecture, design and the places we share')
  ->save();

// Articles get a standfirst (the line under the headline, also the excerpt on
// teaser cards) and a body. Drupal 12 has no text_with_summary field type.
$fields = [
  'field_standfirst' => ['string_long', 'Standfirst', 'string_textarea', ['rows' => 2, 'placeholder' => '']],
  'body' => ['text_long', 'Body', 'text_textarea', ['rows' => 12, 'placeholder' => '']],
];
$form = EntityFormDisplay::load('node.article.default') ?? EntityFormDisplay::create(['targetEntityType' => 'node', 'bundle' => 'article', 'mode' => 'default', 'status' => TRUE]);
$weight = 1;
foreach ($fields as $name => [$type, $label, $widget, $settings]) {
  if (!FieldStorageConfig::load("node.$name")) {
    FieldStorageConfig::create(['field_name' => $name, 'entity_type' => 'node', 'type' => $type, 'cardinality' => 1])->save();
  }
  if (!FieldConfig::load("node.article.$name")) {
    FieldConfig::create(['field_name' => $name, 'entity_type' => 'node', 'bundle' => 'article', 'label' => $label, 'translatable' => TRUE])->save();
  }
  if (!$form->getComponent($name)) {
    $form->setComponent($name, ['type' => $widget, 'weight' => $weight, 'settings' => $settings]);
  }
  $weight++;
}
$form->save();
// Adds the standfirst and body blocks to a Layout Builder section and puts the
// blocks in reading order. Returns the section to store back (getSection()
// hands out a copy).
$arrange = static function (\Drupal\layout_builder\Section $section): \Drupal\layout_builder\Section {
  $order = [
    'extra_field_block:node:article:content_moderation_control' => -2,
    'field_block:node:article:field_standfirst' => -1,
    'field_block:node:article:field_media' => 0,
    'field_block:node:article:body' => 1,
    'extra_field_block:node:article:links' => 2,
  ];
  $present = [];
  foreach ($section->getComponents() as $component) {
    $present[$component->getPluginId()] = TRUE;
  }
  foreach (['field_standfirst' => 'basic_string', 'body' => 'text_default'] as $name => $formatter) {
    if (empty($present["field_block:node:article:$name"])) {
      $section->appendComponent(new SectionComponent(\Drupal::service('uuid')->generate(), 'content', [
        'id' => "field_block:node:article:$name",
        'label_display' => '0',
        'context_mapping' => ['entity' => 'layout_builder.entity'],
        'formatter' => ['type' => $formatter, 'label' => 'hidden', 'settings' => [], 'third_party_settings' => []],
      ]));
    }
  }
  foreach ($section->getComponents() as $component) {
    if (isset($order[$component->getPluginId()])) {
      $component->setWeight($order[$component->getPluginId()]);
    }
  }
  return $section;
};
$full = EntityViewDisplay::load('node.article.default');
if ($full instanceof LayoutEntityDisplayInterface && $full->isLayoutBuilderEnabled()) {
  $section = $arrange($full->getSection(0));
  $full->removeSection(0)->insertSection(0, $section)->save();
}
elseif ($full && !$full->getComponent('body')) {
  $full->setComponent('field_standfirst', ['type' => 'basic_string', 'label' => 'hidden', 'weight' => -1]);
  $full->setComponent('body', ['type' => 'text_default', 'label' => 'hidden', 'weight' => 1])->save();
}
if (!EntityViewDisplay::load('node.article.teaser')) {
  EntityViewDisplay::create(['targetEntityType' => 'node', 'bundle' => 'article', 'mode' => 'teaser', 'status' => TRUE])
    ->setComponent('field_media', ['type' => 'entity_reference_entity_view', 'label' => 'hidden', 'settings' => ['view_mode' => 'default'], 'weight' => 0])
    ->setComponent('field_standfirst', ['type' => 'basic_string', 'label' => 'hidden', 'weight' => 1])
    ->removeComponent('body')
    ->removeComponent('links')
    ->removeComponent('langcode')
    ->save();
}

// The magazine's writers.
$authors = [];
foreach (['Lena Hartmann', 'Tomás Ortega', 'Amira Haddad', 'Jonas Berg'] as $name) {
  $account = user_load_by_name($name);
  if (!$account) {
    $account = User::create(['name' => $name, 'mail' => strtolower(strtr($name, [' ' => '.', 'á' => 'a'])) . '@meridian.example', 'status' => 1]);
    $account->save();
  }
  $authors[$name] = (int) $account->id();
}

// Photos. The first twelve replace the generated images of earlier installs,
// in place.
$photos = [
  ['cloister-arches', 'Cloister arches', 'A vaulted cloister walk with warm light falling between stone arches', 'Harbour at dawn'],
  ['carved-door', 'Carved wooden door', 'A carved wooden double door set in a weathered stone facade', 'Red door'],
  ['yellow-courtyard', 'Yellow courtyard', 'A yellow house front with a bicycle parked under a tree', 'Forest path'],
  ['harbour-boats', 'Harbour boats', 'Wooden fishing boats moored close together in a harbour', 'Desert dunes'],
  ['harbour-crane', 'Harbour crane', 'A yellow floating crane on calm water at dusk', 'Night city'],
  ['red-tram', 'Red tram', 'A red heritage tram on a busy pedestrian street', 'Glacier'],
  ['yellow-trams', 'Yellow trams', 'Two yellow trams passing on a hillside street', 'Lavender field'],
  ['station-concourse', 'Station concourse', 'Crowds crossing a railway concourse under tall arched windows', 'Lemon grove'],
  ['station-roof', 'Station roof', 'The curved iron and glass roof of a railway hall', 'Slate roof'],
  ['glass-roof', 'Glass roof', 'A lattice glass roof seen from below', 'Coral reef'],
  ['laundry-lane', 'Laundry lane', 'Washing hung between colourful houses on a narrow lane', 'Autumn maple'],
  ['cobbled-alley', 'Cobbled alley', 'A cobbled alley between ochre and red walls', 'Morning fog'],
  ['kitchen-table', 'Kitchen table', 'A wooden table with white chairs by a large window', NULL],
  ['orange-chair', 'Orange chair', 'An orange moulded chair at a wooden desk with a notebook', NULL],
  ['canal-houses', 'Canal houses', 'Gabled houses and small boats along a canal', NULL],
  ['canal-evening', 'Canal at dusk', 'A canal at dusk with the lights of the houses reflected in the water', NULL],
  ['concrete-tower', 'Concrete tower', 'A weathered concrete building against a pale sky', NULL],
  ['glass-tower', 'Glass tower', 'A glass apartment tower behind a row of palm trees', NULL],
  ['corner-cafe', 'Corner café', 'A red brick corner building with café umbrellas on the pavement', NULL],
  ['brick-street', 'Brick street', 'A quiet street between brick warehouses and white town houses', NULL],
  ['cafe-window', 'Café window', 'A man reading at a café table by a bright window', NULL],
  ['cafe-silhouettes', 'Café silhouettes', 'People seated in silhouette against the tall windows of a café', NULL],
  ['hillside-town', 'Hillside town', 'Colourful houses stacked on a cliff above the sea', NULL],
  ['green-facades', 'Old town street', 'A sloping street of pastel houses with ivy and parked cars', NULL],
  ['high-street', 'High street', 'A busy high street with a red double-decker bus', NULL],
  ['balcony-street', 'Balcony street', 'A long narrow street lined with wrought-iron balconies', NULL],
];

$directory = 'public://demo';
\Drupal::service('file_system')->prepareDirectory($directory, FileSystemInterface::CREATE_DIRECTORY);
$source = DRUPAL_ROOT . '/../assets/demo-photos';
$media_storage = $etm->getStorage('media');

$media = [];
foreach ($photos as [$slug, $name, $alt, $legacy]) {
  // Already there: by name, or by its photo (a media item whose file changes
  // takes the file name as its name, through the type's field map).
  $ids = $media_storage->getQuery()->accessCheck(FALSE)->condition('bundle', 'image')
    ->condition($media_storage->getQuery()->orConditionGroup()
      ->condition('name', $name)
      ->condition('field_media_image.entity.uri', "$directory/$slug.jpg"))
    ->sort('mid')->range(0, 1)->execute();
  if ($ids) {
    $item = $media_storage->load(reset($ids));
    if ($item->label() !== $name) {
      $item->set('name', $name)->save();
    }
    $media[$slug] = (int) $item->id();
    continue;
  }
  $file = \Drupal::service('file.repository')->writeData((string) file_get_contents("$source/$slug.jpg"), "$directory/$slug.jpg", FileExists::Replace);
  $file->setPermanent();
  $file->save();
  $item = $legacy ? (current($media_storage->loadByProperties(['bundle' => 'image', 'name' => $legacy])) ?: NULL) : NULL;
  $item ??= Media::create(['bundle' => 'image']);
  $item->set('name', $name);
  $item->set('uid', $authors['Lena Hartmann']);
  $item->set('field_media_image', ['target_id' => $file->id(), 'alt' => $alt]);
  $item->save();
  if ($item->label() !== $name) {
    $item->set('name', $name)->save();
  }
  $media[$slug] = (int) $item->id();
}

$articles = [
  [
    'title' => 'The quiet return of the courtyard',
    'legacy' => 'A contract, not a theme',
    'author' => 'Lena Hartmann',
    'date' => '2026-10-12 09:30',
    'photos' => ['cloister-arches', 'carved-door', 'yellow-courtyard'],
    'summary' => 'New housing turned its back on the courtyard for decades. Architects are bringing it back as a room without a roof, shared by everyone in the building.',
    'body' => <<<'HTML'
      <p>For most of the last century, new housing turned its back on the courtyard. It took up land that could have been rented, and it needed neighbours who agreed on how to share it. Now architects are bringing it back, and not for nostalgia.</p>
      <h2>A room without a roof</h2>
      <p>A courtyard works like a room that belongs to everyone in the building. Children play out of sight of traffic but within earshot of a kitchen window. Bikes, bins and deliveries stop cluttering the street. In summer the shade of a single tree can cool the flats around it by several degrees.</p>
      <p>The new examples are small. Many are no bigger than a tennis court, reached through a gate that is open by day and locked at night. What makes them work is not their size but their edges: ground-floor flats with doors straight onto the yard, benches by the entrances and a clear rule about who looks after the plants.</p>
      <h2>Shared, not public</h2>
      <p>The architects we spoke to all drew the same line. A courtyard is shared, not public. It needs a threshold that tells a stranger they are a guest. Get that wrong and residents start locking the gate for good.</p>
      HTML,
    'ar' => [
      'title' => 'العودة الهادئة للفناء',
      'summary' => 'أدارت المساكن الجديدة ظهرها للفناء لعقود، واليوم يعيده المعماريون غرفةً بلا سقف يتشاركها سكان المبنى.',
      'body' => <<<'HTML'
        <p>لعقود طويلة أدارت المساكن الجديدة ظهرها للفناء الداخلي. فقد كان يشغل أرضًا يمكن تأجيرها، ويحتاج إلى جيران يتفقون على طريقة مشاركته. واليوم يعيده المعماريون، ولكن ليس بدافع الحنين.</p>
        <h2>غرفة بلا سقف</h2>
        <p>يعمل الفناء كغرفة يملكها جميع سكان المبنى. يلعب الأطفال بعيدًا عن حركة السير وعلى مسمع من نوافذ المطابخ، وفي الصيف يكفي ظل شجرة واحدة لتلطيف حرارة الشقق المحيطة به.</p>
        HTML,
    ],
  ],
  [
    'title' => 'A harbour town learns to live with water',
    'legacy' => 'One module, every theme',
    'author' => 'Tomás Ortega',
    'date' => '2026-10-08 08:00',
    'photos' => ['harbour-boats', 'harbour-crane'],
    'summary' => 'The old harbour was built to keep the sea out. The new plan lets it in, with stepped terraces that flood a few times a year and dry out within a day.',
    'body' => <<<'HTML'
      <p>The old harbour was built to keep the sea out. The new plan lets it in. Along a kilometre of quay, the town is replacing its flood wall with stepped terraces that can go under water a few times a year and dry out again within a day.</p>
      <p>On a calm afternoon the steps are full of people eating lunch with their feet above the water. On a stormy night they are a buffer that takes the force out of the waves before they reach the houses behind.</p>
      <h2>Designing for the bad days</h2>
      <p>Every bench, lamp and railing on the new quay has been chosen to survive being submerged. The paving drains in minutes. Shops on the waterfront have raised their thresholds and moved their electrics upstairs. None of it is visible on a sunny day, which is exactly the point.</p>
      <p>The fishing fleet stays. The boats now tie up a little further out, at floating pontoons that rise and fall with the tide instead of fighting it.</p>
      HTML,
    // A pending edit, so the moderation control has a draft to show.
    'draft' => ['log' => "Add the harbour master's quote", 'append' => '<p>"We stopped asking how to keep the water out," the harbour master told us, "and started asking where it should go."</p>'],
    'ar' => [
      'title' => 'مدينة ساحلية تتعلم العيش مع الماء',
      'summary' => 'بُني الميناء القديم ليُبقي البحر بعيدًا، أما الخطة الجديدة فتسمح له بالدخول عبر مدرّجات يغمرها الماء ثم تجف خلال يوم.',
      'body' => <<<'HTML'
        <p>بُني الميناء القديم ليُبقي البحر بعيدًا، أما الخطة الجديدة فتسمح له بالدخول. على امتداد كيلومتر من الرصيف تستبدل المدينة جدار الحماية من الفيضانات بمدرّجات يغمرها الماء بضع مرات في السنة ثم تجف خلال يوم واحد.</p>
        <p>في الأيام الهادئة تمتلئ المدرّجات بأناس يتناولون غداءهم فوق الماء، وفي ليالي العواصف تمتص قوة الأمواج قبل أن تصل إلى البيوت.</p>
        HTML,
    ],
  ],
  [
    'title' => 'Why the tram keeps coming back',
    'author' => 'Amira Haddad',
    'date' => '2026-10-02 10:15',
    'photos' => ['red-tram', 'yellow-trams'],
    'summary' => 'Cities tore up their tram lines to make room for cars. Now more than a hundred are building new ones, and the reasons have more to do with streets than with transport.',
    'body' => <<<'HTML'
      <p>Cities spent the 1950s and 60s tearing up their tram lines to make room for cars. Today more than a hundred cities around the world are building new ones. The reasons have less to do with transport than with streets.</p>
      <p>A tram tells you where it is going. Its rails are a promise that the line will still be there in twenty years, and shops, schools and homes move to be near it. A bus route can change overnight.</p>
      <h2>A slower kind of fast</h2>
      <p>Trams are not faster than buses in mixed traffic. Where they win is in how much of the street they give back. A single track bed, planted with grass, can replace two lanes of traffic and carry more people than both.</p>
      <p>The heritage lines still running, from Lisbon's yellow cars to the red one on İstiklal Avenue, show what happens when a city keeps them: the tram becomes part of its identity, a postcard and a commute at once.</p>
      HTML,
  ],
  [
    'title' => 'The stations we love to wait in',
    'author' => 'Jonas Berg',
    'date' => '2026-09-26 09:00',
    'photos' => ['station-concourse', 'station-roof', 'glass-roof'],
    'summary' => 'Nobody plans to spend time in a railway station, yet the great ones make you want to arrive early. The reason is almost always the roof.',
    'body' => <<<'HTML'
      <p>Nobody plans to spend time in a railway station, yet the great ones make you want to arrive early. The reason is almost always the roof.</p>
      <p>A concourse under a high vault of glass and iron does something no airport terminal manages: it makes a crowd feel calm. Light falls from above, sound rises and softens, and thousands of people crossing in every direction read as a single, slow movement.</p>
      <h2>Keeping the big room</h2>
      <p>Many of these halls survived plans to fill them with shops and mezzanines. The best restorations did the opposite. They cleared the floor, cleaned the glass and moved ticket machines and kiosks to the edges, so the room itself could be the main event again.</p>
      HTML,
  ],
  [
    'title' => 'What narrow streets know',
    'author' => 'Lena Hartmann',
    'date' => '2026-09-19 11:00',
    'photos' => ['laundry-lane', 'cobbled-alley'],
    'summary' => 'The narrowest lanes in old towns were never drawn on a plan. Planners used to widen them; now they study them.',
    'body' => <<<'HTML'
      <p>The narrowest streets in old towns were not drawn on a plan. They grew from paths between front doors, and they still carry the habits of the people who made them: washing lines strung from window to window, chairs set out on the step, plants that creep from one house to the next.</p>
      <p>Planners used to see these lanes as a problem to widen. Today they study them. A street four metres wide stays shaded in summer, keeps cars at walking pace without a single sign and makes it almost impossible not to greet a neighbour.</p>
      <p>New neighbourhoods are borrowing the idea, with lanes kept narrow on purpose and given back to the people who live on them.</p>
      HTML,
  ],
  [
    'title' => 'The table at the centre of the home',
    'author' => 'Amira Haddad',
    'date' => '2026-09-12 08:30',
    'photos' => ['kitchen-table', 'orange-chair'],
    'summary' => 'Open-plan flats merged the kitchen, dining room and living room. What holds the space together is a single piece of furniture.',
    'body' => <<<'HTML'
      <p>Floor plans have spent decades knocking down walls. The kitchen, the dining room and the living room have merged into one open space. What holds that space together is a piece of furniture: the table.</p>
      <p>The designers we met treat it as the most important object in a flat. It is where homework gets done, where guests end up no matter how big the sofa is and, for many people, where the working day now starts and ends.</p>
      <h2>Built to be used</h2>
      <p>The tables that last share a few traits. A solid top that can take a hot pan and a laptop. Legs set far enough in that nobody straddles one. And chairs light enough to pull up with one hand, which is why a single bright moulded chair can bring a whole room to life.</p>
      HTML,
  ],
  [
    'title' => 'Canals after dark',
    'author' => 'Tomás Ortega',
    'date' => '2026-09-05 19:00',
    'photos' => ['canal-houses', 'canal-evening'],
    'summary' => 'By day the canals are working water. At night the lights of the houses double in them, and cities have learned to light them with care.',
    'body' => <<<'HTML'
      <p>By day the canals are working water: delivery boats, rowing clubs, tourists counting bridges. At night they turn into something else. The water goes still, the lights of the houses double in it, and the quays fill with people who came for a walk and stayed for dinner.</p>
      <p>Cities with canals have learned to light them carefully. Warm, low lamps along the edge instead of tall floodlights. Bridges lit from underneath so their arches show. Dark stretches left alone, because reflections only work when there is darkness around them.</p>
      HTML,
  ],
  [
    'title' => 'Concrete, reconsidered',
    'author' => 'Jonas Berg',
    'date' => '2026-08-29 09:45',
    'photos' => ['concrete-tower', 'glass-tower'],
    'summary' => 'For a generation, concrete stood for everything wrong with post-war building. Cleaned and repaired, many of those buildings turn out to be finely made.',
    'body' => <<<'HTML'
      <p>For a generation, concrete was shorthand for everything wrong with post-war building: grey, stained and cold. A wave of restorations is changing the story.</p>
      <p>Cleaned and repaired, the same facades turn out to be finely made, with board-marked surfaces that show the grain of the timber they were cast against and deep window reveals that keep the sun off the glass. Many of these buildings outperform their glass neighbours on heat, noise and upkeep.</p>
      <h2>The carbon question</h2>
      <p>Concrete is also one of the most carbon-intensive materials we have. That is the strongest argument for keeping what already stands. The greenest building, as one engineer put it to us, is usually the one you don't knock down.</p>
      HTML,
  ],
  [
    'title' => 'Living above the shop',
    'author' => 'Amira Haddad',
    'date' => '2026-08-22 10:00',
    'photos' => ['corner-cafe', 'brick-street'],
    'summary' => 'Above the shopfronts of many high streets, the windows are dark. Councils are trying to fill them with homes again.',
    'body' => <<<'HTML'
      <p>Walk down an old high street and look up. Above the shopfronts, many windows are dark: storerooms, empty offices, flats nobody has lived in for years. Councils across Europe are now trying to fill them again.</p>
      <p>Living above the shop used to be normal. The baker lived over the bakery, the tailor over the tailor's. Bringing that back puts people on the street in the evening, after the shops close, which is when a town centre feels most deserted.</p>
      <p>The obstacles are practical. Many upper floors can only be reached through the shop itself. The schemes that work give them their own front door, often from a side street or a rear yard.</p>
      HTML,
  ],
  [
    'title' => 'The café as a public room',
    'author' => 'Lena Hartmann',
    'date' => '2026-08-15 08:15',
    'photos' => ['cafe-window', 'cafe-silhouettes'],
    'summary' => "A good café is the closest thing a city has to a shared living room, and its design is more deliberate than it looks.",
    'body' => <<<'HTML'
      <p>A good café is the closest thing a city has to a shared living room. You can stay for an hour on the price of a coffee, read, work, or simply watch the street through a big window.</p>
      <p>The design of these rooms is more deliberate than it looks. Long tables encourage strangers to sit together. A counter facing the window gives solo visitors somewhere to belong. Light low enough to feel warm but bright enough to read by keeps people coming back in the afternoon.</p>
      HTML,
  ],
  [
    'title' => 'Colour on the hill',
    'author' => 'Tomás Ortega',
    'date' => '2026-08-08 12:00',
    'photos' => ['hillside-town', 'green-facades'],
    'summary' => 'Seen from the sea, the town looks painted. The palette is no accident: it is written into the local building rules.',
    'body' => <<<'HTML'
      <p>Seen from the sea, the town looks painted. Ochre, rose, sage and terracotta houses climb the cliff, each a slightly different shade from its neighbour. The palette is not an accident: it is written into local building rules.</p>
      <p>Owners can choose their colour, but only from a set of pigments that have been used in the region for centuries. The result is variety without chaos, and a skyline that fishermen once used to find their own homes from the water.</p>
      HTML,
  ],
  [
    'title' => "The high street isn't dead",
    'author' => 'Jonas Berg',
    'date' => '2026-08-01 09:00',
    'photos' => ['high-street', 'balcony-street'],
    'summary' => 'Online shopping was supposed to empty the high street. In many towns, something more local moved in when the chains left.',
    'body' => <<<'HTML'
      <p>Online shopping was supposed to empty the high street. In many towns it did the opposite of what was predicted: chain stores left, and something more local moved in.</p>
      <p>Repair shops, small bakeries, studios, a library branch in a former bank. Streets that lost their big names have found that a mix of uses, open at different hours, keeps them busier than a row of identical shopfronts ever did.</p>
      HTML,
  ],
];

$node_storage = $etm->getStorage('node');
$moderated = \Drupal::moduleHandler()->moduleExists('content_moderation')
  && \Drupal::service('content_moderation.moderation_information')->shouldModerateEntitiesOfBundle($etm->getDefinition('node'), 'article');
$created = 0;
$updated = 0;
foreach ($articles as $a) {
  if ($node_storage->loadByProperties(['type' => 'article', 'title' => $a['title']])) {
    continue;
  }
  $node = isset($a['legacy']) ? (current($node_storage->loadByProperties(['type' => 'article', 'title' => $a['legacy']])) ?: NULL) : NULL;
  $node ? $updated++ : $created++;
  $node ??= Node::create(['type' => 'article', 'langcode' => 'en']);
  $time = $at($a['date']);
  $node->set('title', $a['title']);
  $node->set('uid', $authors[$a['author']]);
  $node->set('created', $time);
  $node->set('changed', $time);
  $node->set('status', 1);
  $node->set('promote', 1);
  $node->set('field_standfirst', $a['summary']);
  $node->set('body', ['value' => trim($a['body']), 'format' => 'basic_html']);
  $node->set('field_media', array_map(fn ($slug) => ['target_id' => $media[$slug]], $a['photos']));
  if ($moderated) {
    $node->set('moderation_state', 'published');
  }
  $node->setNewRevision();
  $node->setRevisionLogMessage('Meridian demo content');
  $node->save();

  if (isset($a['ar'])) {
    $values = [
      'title' => $a['ar']['title'],
      'uid' => $authors[$a['author']],
      'field_standfirst' => $a['ar']['summary'],
      'body' => ['value' => trim($a['ar']['body']), 'format' => 'basic_html'],
      'field_media' => $node->get('field_media')->getValue(),
      'content_translation_uid' => $authors[$a['author']],
    ];
    $translation = $node->hasTranslation('ar') ? $node->getTranslation('ar') : $node->addTranslation('ar');
    foreach ($values as $field => $value) {
      if ($translation->hasField($field)) {
        $translation->set($field, $value);
      }
    }
    if ($moderated) {
      $translation->set('moderation_state', 'published');
    }
    $translation->save();
  }

  if ($moderated && isset($a['draft'])) {
    $draft = $node_storage->load($node->id());
    $draft->setNewRevision();
    $draft->setRevisionLogMessage($a['draft']['log']);
    $draft->set('body', ['value' => trim($a['body']) . "\n" . $a['draft']['append'], 'format' => 'basic_html']);
    $draft->set('moderation_state', 'draft');
    $draft->save();
  }
}

// A node with its own layout (the regions test gives node 1 one) gets the
// same blocks in the same order.
foreach ($node_storage->loadByProperties(['type' => 'article']) as $node) {
  if ($node->hasField('layout_builder__layout') && !$node->get('layout_builder__layout')->isEmpty()) {
    $sections = $node->get('layout_builder__layout')->getSections();
    $sections[0] = $arrange($sections[0]);
    $node->set('layout_builder__layout', $sections);
    $node->setNewRevision(FALSE);
    $node->setSyncing(TRUE);
    $node->save();
  }
}

// The landing page and the Layout Paragraphs page exist once the contrib setup
// has run (tests/proof/contrib.mjs); their paragraphs are rewritten in place.
$pages = [
  [
    'type' => 'landing',
    'legacy' => 'A landing page built from paragraphs',
    'title' => 'About Meridian',
    'texts' => [
      'Meridian is an independent magazine about architecture, design and the places we share: streets, stations, courtyards and the rooms where a city meets itself.',
      'We publish one long read every week and a printed issue every season. Our writers are architects, planners, historians and people who simply notice things on their way to work.',
      'We are reader-funded. There is no advertising on this site and there never will be. If you enjoy what we do, the best way to support it is a subscription.',
      'Write to us at letters@meridian.example with stories from your own street. We read every letter, and the best ones end up in print.',
    ],
  ],
  [
    'type' => 'lp_page',
    'legacy' => 'A page built with Layout Paragraphs',
    'title' => 'Issue 14: The shared city',
    'texts' => [
      'This issue is about the spaces between buildings: the courtyards, quays, platforms and pavements that belong to nobody in particular and to everyone at once.',
      'Inside: the return of the courtyard, a harbour that lets the sea in, and why the tram keeps coming back. On sale from 1 November.',
    ],
  ],
];
foreach ($pages as $p) {
  $node = current($node_storage->loadByProperties(['type' => $p['type'], 'title' => $p['legacy']])) ?: NULL;
  if (!$node || !$node->hasField('field_sections')) {
    continue;
  }
  $texts = $p['texts'];
  $items = [];
  foreach ($node->get('field_sections')->referencedEntities() as $paragraph) {
    if ($paragraph->bundle() === 'text' && $texts) {
      $paragraph->set('field_text', array_shift($texts));
      $paragraph->save();
    }
    $items[] = ['target_id' => $paragraph->id(), 'target_revision_id' => $paragraph->getRevisionId()];
  }
  // Layout Paragraphs places paragraphs in regions; only a plain landing page
  // gets the remaining texts as new sections.
  if ($p['type'] === 'landing') {
    foreach ($texts as $text) {
      $paragraph = Paragraph::create(['type' => 'text', 'field_text' => $text]);
      $paragraph->save();
      $items[] = ['target_id' => $paragraph->id(), 'target_revision_id' => $paragraph->getRevisionId()];
    }
  }
  $node->set('field_sections', $items);
  $node->set('title', $p['title']);
  $node->set('uid', $authors['Lena Hartmann']);
  $node->save();
  $updated++;
}

echo count($media) . " media items, $created articles created, $updated nodes updated.\n";
