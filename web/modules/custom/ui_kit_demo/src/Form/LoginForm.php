<?php

declare(strict_types=1);

namespace Drupal\ui_kit_demo\Form;

use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * The demo's sign-in screen. It signs nobody in and keeps nothing.
 */
final class LoginForm extends FormBase {

  /**
   * {@inheritdoc}
   */
  public function getFormId(): string {
    return 'ui_kit_demo_login';
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
    // Off, so browsers don't offer to save a real password for a demo screen.
    $form['#attributes'] = ['autocomplete' => 'off'];
    $form['email'] = [
      '#type' => 'email',
      '#title' => $this->t('Email'),
      '#required' => TRUE,
    ];
    $form['password'] = [
      '#type' => 'password',
      '#title' => $this->t('Password'),
      '#required' => TRUE,
      '#attributes' => ['autocomplete' => 'off'],
    ];
    $form['remember'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Keep me signed in'),
    ];
    $form['actions'] = ['#type' => 'actions'];
    $form['actions']['submit'] = [
      '#type' => 'submit',
      '#value' => $this->t('Sign in'),
      '#button_type' => 'primary',
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
    // Nothing is checked or kept: any address and password open the demo.
    $form_state->setRedirect('ui_kit_demo.content');
  }

}
