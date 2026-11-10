<?php

declare(strict_types=1);

namespace Drupal\ui_kit_demo\Form;

use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Url;

/**
 * The demo's "New article" form: the usual controls, nothing saved.
 */
final class ArticleForm extends FormBase {

  /**
   * {@inheritdoc}
   */
  public function getFormId(): string {
    return 'ui_kit_demo_article';
  }

  /**
   * {@inheritdoc}
   *
   * @param array<mixed> $form
   *   The form.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   *
   * @return array<mixed>
   *   The form.
   */
  public function buildForm(array $form, FormStateInterface $form_state): array {
    $form['title'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Title'),
      '#required' => TRUE,
      '#maxlength' => 120,
    ];
    $form['summary'] = [
      '#type' => 'textarea',
      '#title' => $this->t('Summary'),
      '#description' => $this->t('One or two sentences for teasers and search results.'),
      '#rows' => 3,
    ];
    $form['section'] = [
      '#type' => 'select',
      '#title' => $this->t('Section'),
      '#options' => [
        'news' => $this->t('News'),
        'guides' => $this->t('Guides'),
        'opinion' => $this->t('Opinion'),
      ],
      '#empty_option' => $this->t('- Choose -'),
    ];
    $form['tags'] = [
      '#type' => 'checkboxes',
      '#title' => $this->t('Tags'),
      '#options' => [
        'drupal' => $this->t('Drupal'),
        'design' => $this->t('Design'),
        'accessibility' => $this->t('Accessibility'),
      ],
    ];
    $form['status'] = [
      '#type' => 'radios',
      '#title' => $this->t('Status'),
      '#options' => [
        'draft' => $this->t('Draft'),
        'review' => $this->t('Ready for review'),
        'published' => $this->t('Published'),
      ],
      '#default_value' => 'draft',
    ];
    $form['publish_on'] = [
      '#type' => 'date',
      '#title' => $this->t('Publish on'),
    ];
    $form['advanced'] = [
      '#type' => 'details',
      '#title' => $this->t('Advanced'),
    ];
    $form['advanced']['alias'] = [
      '#type' => 'textfield',
      '#title' => $this->t('URL alias'),
      '#field_prefix' => '/',
    ];
    $form['advanced']['promote'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Promote to the front page'),
    ];
    $form['actions'] = ['#type' => 'actions'];
    $form['actions']['submit'] = [
      '#type' => 'submit',
      '#value' => $this->t('Save'),
      '#button_type' => 'primary',
    ];
    $form['actions']['cancel'] = [
      '#type' => 'link',
      '#title' => $this->t('Cancel'),
      '#url' => Url::fromRoute('ui_kit_demo.content'),
    ];
    return $form;
  }

  /**
   * {@inheritdoc}
   *
   * @param array<mixed> $form
   *   The form.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   */
  public function submitForm(array &$form, FormStateInterface $form_state): void {
    // Nothing is saved; the content screen says so.
    $form_state->setRedirect('ui_kit_demo.content', [], ['query' => ['saved' => '1']]);
  }

}
