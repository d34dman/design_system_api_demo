<?php

declare(strict_types=1);

namespace Drupal\advaita_showcase\Form;

use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Url;

/**
 * The spec sheet: core's elements in every state, for the design probe.
 *
 * Each element carries a data-spec id. An id names the Radix sample it is
 * measured against (tests/proof/spec/radix-reference.html); "id@variant" is
 * a second Drupal element measured against the same sample. Nothing here is
 * styled: the page shows what the chrome draws for core's markup.
 */
final class SpecSheetForm extends FormBase {

  /**
   * {@inheritdoc}
   */
  public function getFormId(): string {
    return 'advaita_showcase_spec_sheet';
  }

  /**
   * {@inheritdoc}
   *
   * @param array<string, mixed> $form
   *   The form.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   *
   * @return array<string, mixed>
   *   The form.
   */
  public function buildForm(array $form, FormStateInterface $form_state): array {
    if (!$form_state->isSubmitted()) {
      $this->messenger()->addStatus($this->t('Saved the configuration.'));
      $this->messenger()->addError($this->t('The name is required.'));
      $this->messenger()->addWarning($this->t('Check the changes.'));
    }

    $form['buttons'] = [
      '#type' => 'container',
      '#attributes' => ['class' => ['container-inline']],
      'solid' => $this->button('Save', 'button-solid', ['#button_type' => 'primary']),
      'surface' => $this->button('Add media', 'button-surface'),
      'soft' => $this->button('Filter', 'button-soft', [], ['ds-button--soft']),
      'neutral' => $this->button('Edit', 'button-neutral', [], ['ds-button--neutral']),
      'ghost' => $this->button('Ghost', 'button-ghost', [], ['ds-button--ghost']),
      'danger' => $this->button('Remove', 'button-danger', ['#button_type' => 'danger']),
      'danger_solid' => $this->button('Delete', 'button-danger-solid', [], ['ds-button--danger-solid']),
      'disabled' => $this->button('Disabled', 'button-disabled', ['#button_type' => 'primary', '#disabled' => TRUE]),
      'small' => $this->button('Small', 'button-small', [], ['button--small']),
      'small_neutral' => $this->button('Edit', 'button-small-neutral', [], ['button--small', 'ds-button--neutral']),
      'link' => [
        '#type' => 'link',
        '#title' => $this->t('Add content'),
        '#url' => Url::fromRoute('<front>'),
        '#attributes' => ['class' => ['button'], 'data-spec' => 'button-surface@link'],
      ],
      'link_danger' => [
        '#type' => 'link',
        '#title' => $this->t('Remove block'),
        '#url' => Url::fromRoute('<front>'),
        '#attributes' => ['class' => ['button', 'button--danger'], 'data-spec' => 'button-danger@link'],
      ],
    ];

    $form['text'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Site name'),
      '#default_value' => 'Meridian',
      '#description' => $this->t("How this is used depends on your site's theme."),
      '#attributes' => ['data-spec' => 'textfield'],
      '#label_attributes' => ['data-spec' => 'label'],
      '#description_attributes' => ['data-spec' => 'description'],
    ];
    $form['placeholder'] = [
      '#type' => 'search',
      '#title' => $this->t('Search'),
      '#placeholder' => $this->t('Search'),
      '#attributes' => ['data-spec' => 'textfield-placeholder'],
    ];
    $form['disabled_text'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Disabled'),
      '#default_value' => 'Disabled',
      '#disabled' => TRUE,
      '#attributes' => ['data-spec' => 'textfield-disabled'],
    ];
    $form['email'] = [
      '#type' => 'email',
      '#title' => $this->t('Email address'),
      '#default_value' => 'admin@example.com',
      '#attributes' => ['data-spec' => 'textfield@email'],
    ];
    $form['password'] = [
      '#type' => 'password_confirm',
      '#title' => $this->t('Password'),
    ];
    $form['select'] = [
      '#type' => 'select',
      '#title' => $this->t('Published status'),
      '#options' => ['' => $this->t('- Any -'), 1 => $this->t('Published'), 0 => $this->t('Unpublished')],
      '#attributes' => ['data-spec' => 'select'],
    ];
    $form['textarea'] = [
      '#type' => 'textarea',
      '#title' => $this->t('Description'),
      '#default_value' => 'Text',
      '#rows' => 3,
      '#attributes' => ['data-spec' => 'textarea'],
    ];
    $form['file'] = [
      '#type' => 'file',
      '#title' => $this->t('Picture'),
      '#attributes' => ['data-spec' => 'textfield@file'],
    ];

    $form['checkbox'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Content editor'),
      '#attributes' => ['data-spec' => 'checkbox'],
    ];
    $form['checkbox_checked'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Administrator'),
      '#default_value' => 1,
      '#attributes' => ['data-spec' => 'checkbox-checked'],
    ];
    $form['checkbox_disabled'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Authenticated user'),
      '#default_value' => 1,
      '#disabled' => TRUE,
      '#attributes' => ['data-spec' => 'checkbox-disabled'],
    ];
    $form['radios'] = [
      '#type' => 'radios',
      '#title' => $this->t('Display'),
      '#options' => ['grid' => $this->t('Grid'), 'table' => $this->t('Table')],
      '#default_value' => 'table',
    ];
    $form['radios']['grid']['#attributes']['data-spec'] = 'radio';
    $form['radios']['table']['#attributes']['data-spec'] = 'radio-checked';

    $form['details'] = [
      '#type' => 'details',
      '#title' => $this->t('Language settings'),
      '#open' => TRUE,
      '#attributes' => ['data-spec' => 'card@details'],
      'language' => [
        '#type' => 'select',
        '#title' => $this->t('Site language'),
        '#options' => ['en' => 'English', 'ar' => 'Arabic'],
      ],
    ];
    $form['fieldset'] = [
      '#type' => 'fieldset',
      '#title' => $this->t('Roles'),
      '#attributes' => ['data-spec' => 'card@fieldset'],
      'role' => [
        '#type' => 'checkbox',
        '#title' => $this->t('Content editor'),
      ],
    ];

    $form['table'] = [
      '#type' => 'table',
      '#attributes' => ['data-spec' => 'table'],
      '#header' => [
        ['data' => $this->t('Title'), 'data-spec' => 'table-header'],
        $this->t('Status'),
      ],
      '#rows' => [
        [
          'data' => [['data' => 'About Meridian', 'data-spec' => 'table-cell'], 'Published'],
          'data-spec' => 'table-row',
        ],
        ['About Meridian', 'Published'],
      ],
    ];

    $form['actions'] = [
      '#type' => 'actions',
      'submit' => [
        '#type' => 'submit',
        '#value' => $this->t('Save configuration'),
        '#button_type' => 'primary',
        '#attributes' => ['data-spec' => 'button-solid@actions'],
      ],
    ];
    return $form;
  }

  /**
   * A submit button with a data-spec id.
   *
   * @param string $label
   *   The label.
   * @param string $spec
   *   The data-spec id.
   * @param array<string, mixed> $extra
   *   More element properties.
   * @param list<string> $classes
   *   Classes for the button.
   *
   * @return array<string, mixed>
   *   The element.
   */
  private function button(string $label, string $spec, array $extra = [], array $classes = []): array {
    return [
      '#type' => 'submit',
      '#value' => $label,
      '#name' => $spec,
      '#attributes' => ['data-spec' => $spec, 'class' => $classes],
    ] + $extra;
  }

  /**
   * {@inheritdoc}
   *
   * @param array<string, mixed> $form
   *   The form.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   */
  public function submitForm(array &$form, FormStateInterface $form_state): void {
    $form_state->setRebuild();
  }

}
