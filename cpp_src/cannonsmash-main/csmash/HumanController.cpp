/**
 * @file
 * @brief Implementation of HumanController class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2007  Kanna Yoshihiro
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

#include "ttinc.h"
#include "HumanController.h"
#include "Control.h"
#include "PlayGame.h"
#include "BaseView.h"
#include "RCFile.h"
#include "Ball.h"

extern RCFile *theRC;
extern Ball theBall;

/***********************************************************************
 *	Class  HumanController
 ***********************************************************************/

/**
 * Default constructor.
 */
HumanController::HumanController() {
}

/**
 * Constructor.
 * Set parent.
 *
 * @param side side of the player.
 */
HumanController::HumanController( Player *parent ) {
  m_parent = parent;
}

/**
 * Destructor.
 * Detach view class.
 */
HumanController::~HumanController() {
}

/**
 * Move this player object.
 * Move this player and change m_status.
 *
 * @param KeyHistory history of keyboard input
 * @param MouseXHistory history of mouse cursor move
 * @param MouseYHistory history of mouse cursor move
 * @param MouseBHistory history of mouse button push/release
 * @param Histptr current position of histories described above.
 * @return returns true if it is neccesary to redraw.
 */
bool
HumanController::Move( SDL_keysym *KeyHistory, long *MouseXHistory,
		       long *MouseYHistory, unsigned long *MouseBHistory,
		       int Histptr ) {

  if ( Control::TheControl()->IsPlaying() &&
	 !((PlayGame *)Control::TheControl())->IsPause() )
    KeyCheck( KeyHistory, MouseXHistory, MouseYHistory, MouseBHistory,Histptr );

  return true;
}

/**
 * Check keyboard input, mouse move and click to move player.
 *
 * @param KeyHistory history of keyboard input
 * @param MouseXHistory history of mouse cursor move
 * @param MouseYHistory history of mouse cursor move
 * @param MouseBHistory history of mouse button push/release
 * @param Histptr current position of histories described above.
 * @return returns true if succeeds.
 */
bool
HumanController::KeyCheck( SDL_keysym *KeyHistory, long *MouseXHistory,
			   long *MouseYHistory, unsigned long *MouseBHistory,
			   int Histptr ) {
  long mouse, lastmouse;
  long leftButton, rightButton;

// COM
  if ( !KeyHistory || !MouseXHistory || !MouseYHistory || !MouseBHistory )
    return true;

  long keycode = GetKeyCode(KeyHistory[Histptr]);
  MoveTarget(keycode);
  MoveCamera(keycode);

  if (keycode == ' ') {
    long prev = GetKeyCode(Histptr==0 ? KeyHistory[MAX_HISTORY-1] : KeyHistory[Histptr-1]);
    if ( prev != ' ' )
      m_parent->ChangeServeType();
  }

  // Sorry in Japanese...
  // スイング中は速度が変わらないようにする. こうすることで
  // MultiPlay 時により同期をとりやすくなる.
  // その理由は, スイングを開始した時点で Player のインパクト
  // までの行動が決定されるため, スイング開始時に情報交換すれば
  // 同期がとれるようになるためである. これまでは, インパクト時に
  // 情報を交換していたので, 0.1秒早く同期がとれることになる.

  // ちなみに, スイング後のマウスのドラッグによってボールの回転を
  // 制御する場合, この方法は使えないかも知れない.


  if ( m_parent->GetSwing() > m_parent->stype[m_parent->GetSwingType()]->backswing &&
       m_parent->GetSwing() <= m_parent->stype[m_parent->GetSwingType()]->hitStart ) {
  //TODO: apply stype
  //if ( m_parent->GetSwing() > Player::END_BACKSWING && m_parent->GetSwing() <= Player::START_HITBALL ) {
    long hptr = Histptr-(m_parent->GetSwing()-11);
    if ( hptr < 0 )
      hptr += MAX_HISTORY;

    m_dragX = MouseXHistory[Histptr]-MouseXHistory[hptr];
    m_dragY = MouseYHistory[Histptr]-MouseYHistory[hptr];
  } else {
    vector3d v = m_parent->GetV();
    v[0] = (MouseXHistory[Histptr] - BaseView::GetWinWidth()/2) /
      (BaseView::GetWinWidth()/40)*m_parent->GetSide();
    v[1] = -(MouseYHistory[Histptr] - BaseView::GetWinHeight()/2) /
      (BaseView::GetWinHeight()/40)*m_parent->GetSide();

    v /= 4;
    m_parent->SetV(v);
  }

  if (theRC->switchButtons) {
    leftButton  = BUTTON_RIGHT;
    rightButton = BUTTON_LEFT;
  } else {
    leftButton  = BUTTON_LEFT;
    rightButton = BUTTON_RIGHT;
  }

  mouse = MouseBHistory[Histptr];
  if ( Histptr-1 < 0 )
    lastmouse = MouseBHistory[MAX_HISTORY-1];
  else
    lastmouse = MouseBHistory[Histptr-1];

  if ( (mouse & rightButton) && !(lastmouse & rightButton) ){
    if ( theBall.GetStatus() == 8 &&
	 ((PlayGame *)Control::TheControl())->GetService() == m_parent->GetSide() ) {
      //TODO apply delayed toss
      theBall.Toss( m_parent, 3 );
      m_parent->StartServe(3);
    } else {
      m_parent->AddStatus( (m_parent->GetSwing()-10)*10 );
      m_parent->Swing(3);
    }
  } else if ( (mouse & BUTTON_MIDDLE) && !(lastmouse & BUTTON_MIDDLE) ){
    if ( theBall.GetStatus() == 8 &&
	 ((PlayGame *)Control::TheControl())->GetService() == m_parent->GetSide() ) {
      //TODO apply delayed toss
      theBall.Toss( m_parent, 2 );
      m_parent->StartServe(2);
    } else {
      m_parent->AddStatus( (m_parent->GetSwing()-10)*10 );
      m_parent->Swing(2);
    }
  } else if ( (mouse & leftButton) && !(lastmouse & leftButton) ){
    if ( theBall.GetStatus() == 8 &&
	 ((PlayGame *)Control::TheControl())->GetService() == m_parent->GetSide() ) {
      //TODO apply delayed toss
      theBall.Toss( m_parent, 1 );
      m_parent->StartServe(1);
    } else {
      m_parent->AddStatus( (m_parent->GetSwing()-10)*10 );
      m_parent->Swing(1);
    }
  }

  return true;
}

/**
 * Convert SDL_keysym into key code in unicode.
 * This method supports qwerty, qwertz, azerty and dvorak keyboard.
 *
 * @param key SDL_keysym value converted to unicode.
 * @return returns unicode.
 */
long
HumanController::GetKeyCode( SDL_keysym &key ) {
  const char keytable[][5] = {
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'1', '1', '1', '[', '\0'},
  {'2', '2', '2', '7', '\0'},
  {'3', '3', '3', '5', '\0'},
  {'4', '4', '4', '3', '\0'},
  {'5', '5', '5', '1', '\0'},
  {'6', '6', '6', '9', '\0'},
  {'7', '7', '7', '0', '\0'},
  {'8', '8', '8', '2', '\0'},
  {'9', '9', '9', '6', '\0'},
  {'0', '0', '0', '8', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'q', 'q', 'a', '/', '\0'},
  {'w', 'w', 'z', ',', '\0'},
  {'e', 'e', 'e', '.', '\0'},
  {'r', 'r', 'r', 'p', '\0'},
  {'t', 't', 't', 'y', '\0'},
  {'y', 'z', 'y', 'f', '\0'},
  {'u', 'u', 'u', 'g', '\0'},
  {'i', 'i', 'i', 'c', '\0'},
  {'o', 'o', 'o', 'r', '\0'},
  {'p', 'p', 'p', 'l', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'a', 'a', 'q', 'a', '\0'},
  {'s', 's', 's', 'o', '\0'},
  {'d', 'd', 'd', 'e', '\0'},
  {'f', 'f', 'f', 'u', '\0'},
  {'g', 'g', 'g', 'i', '\0'},
  {'h', 'h', 'h', 'd', '\0'},
  {'j', 'j', 'j', 'h', '\0'},
  {'k', 'k', 'k', 't', '\0'},
  {'l', 'l', 'l', 'n', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},	// {          'm', 's', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},
  {'z', 'y', 'w', ';', '\0'},
  {'x', 'x', 'x', 'q', '\0'},
  {'c', 'c', 'c', 'j', '\0'},
  {'v', 'v', 'v', 'k', '\0'},
  {'b', 'b', 'b', 'x', '\0'},
  {'n', 'n', 'n', 'b', '\0'},
  {'m', 'm'     , 'm', '\0', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},	// {               'w', '\0'},
  {'\0', '\0', '\0', '\0', '\0'},	// {               'v', '\0'},
  {'\0', '\0', '\0', '\0', '\0'}	// {               'z', '\0'}
  };

  // Check keyboard type and modify keycode.
  long code = -1;

  if ( key.scancode < 54 ) {
    int i = 0;
    while (keytable[key.scancode][i]) {
      if ( keytable[key.scancode][i] == key.unicode ) {
	code = keytable[key.scancode][0];
	break;
      }
      i++;
    }
  }

  if ( key.scancode >= 8 && key.scancode < 62 && code < 0 ) {	// for X11
    int i = 0;
    while (keytable[key.scancode-8][i]) {
      if ( keytable[key.scancode-8][i] == key.unicode ) {
	code = keytable[key.scancode-8][0];
	break;
      }
      i++;
    }
  }

  if ( code < 0 )
    code = key.unicode;

  return code;
}

/**
 * Move the target.
 *
 * @param code keycode.
 */
void
HumanController::MoveTarget( long keycode ) {
  vector2d target = m_parent->GetTarget();
  switch ( keycode ) {
  case '1':  case 'q':  case 'a':  case 'z':
  case '2':  case 'w':  case 's':  case 'x':
  case '3':
    target[0] = -TABLEWIDTH/2*0.9*m_parent->GetSide();
    break;
  case 'e':
    target[0] = -TABLEWIDTH/2*0.75*m_parent->GetSide();
    break;
  case 'd':
    target[0] = -TABLEWIDTH/2*0.6*m_parent->GetSide();
    break;
  case '4':  case 'c':
    target[0] = -TABLEWIDTH/2*0.45*m_parent->GetSide();
    break;
  case 'r':
    target[0] = -TABLEWIDTH/2*0.3*m_parent->GetSide();
    break;
  case 'f':
    target[0] = -TABLEWIDTH/2*0.15*m_parent->GetSide();
    break;
  case '5':  case 'v':
    target[0] = 0;
    break;
  case 't':
    target[0] = TABLEWIDTH/2*0.15*m_parent->GetSide();
    break;
  case 'g':
    target[0] = TABLEWIDTH/2*0.3*m_parent->GetSide();
    break;
  case '6':  case 'b':
    target[0] = TABLEWIDTH/2*0.45*m_parent->GetSide();
    break;
  case 'y':
    target[0] = TABLEWIDTH/2*0.6*m_parent->GetSide();
    break;
  case 'h':
    target[0] = TABLEWIDTH/2*0.75*m_parent->GetSide();
    break;
  case '7':  case 'n':  case 'u':  case 'j':
  case '8':  case 'm':  case 'i':  case 'k':
  case '9':  case ',':  case 'o':  case 'l':
  case '0':  case '.':  case 'p':  case ';':
    target[0] = TABLEWIDTH/2*0.9*m_parent->GetSide();
    break;
  }

  switch ( keycode ){
  case '1':  case '2':  case '3':  case '4':  case '5':  case '6':
  case '7':  case '8':  case '9':  case '0':  case '-':  case '^':
    target[1] = TABLELENGTH/12*5*m_parent->GetSide();
    break;
  case 'q':  case 'w':  case 'e':  case 'r':  case 't':  case 'y':
  case 'u':  case 'i':  case 'o':  case 'p':  case '@':  case '[':
    target[1] = TABLELENGTH/12*4*m_parent->GetSide();
    break;
  case 'a':  case 's':  case 'd':  case 'f':  case 'g':  case 'h':
  case 'j':  case 'k':  case 'l':  case ';':  case ':':  case ']':
    target[1] = TABLELENGTH/12*3*m_parent->GetSide();
    break;
  case 'z':  case 'x': case 'c':  case 'v':  case 'b':  case 'n':
  case 'm':  case ',':  case '.':  case '/':  case '\\':
    target[1] = TABLELENGTH/12*2*m_parent->GetSide();
    break;
  }
  m_parent->SetTarget(target);
}

/**
 * Move camera location.
 *
 * @param code keycode.
 */
void
HumanController::MoveCamera( long keycode ) {
  switch ( keycode ) {
  case 'H':
    m_parent->GetEye()[0] -= 0.05;
    break;
  case 'J':
    m_parent->GetEye()[2] -= 0.05;
    break;
  case 'K':
    m_parent->GetEye()[2] += 0.05;
    break;
  case 'L':
    m_parent->GetEye()[0] += 0.05;
    break;
  case '<':
    m_parent->GetEye()[1] -= 0.05;
    break;
  case '>':
    m_parent->GetEye()[1] += 0.05;
    break;

  case 'A':
    m_parent->GetLookAt()[0] -= 0.05;
    break;
  case 'S':
    m_parent->GetLookAt()[2] -= 0.05;
    break;
  case 'D':
    m_parent->GetLookAt()[2] += 0.05;
    break;
  case 'F':
    m_parent->GetLookAt()[0] += 0.05;
    break;
  case 'C':
    m_parent->GetLookAt()[1] -= 0.05;
    break;
  case 'V':
    m_parent->GetLookAt()[1] += 0.05;
    break;
  }
}
