import React, { Component } from "react";
import PropTypes from "prop-types";
import classNames from "classnames";
import addMention from "../addMention";
import KeyDownHandler from "../../../event-handler/keyDown";
import SuggestionHandler from "../../../event-handler/suggestions";
import "./styles.css";

class Suggestion {
  constructor(config) {
    const {
      separator,
      trigger,
      getSuggestions,
      onChange,
      getEditorState,
      getWrapperRef,
      caseSensitive,
      dropdownClassName,
      optionClassName,
      modalHandler,
    } = config;
    this.config = {
      separator,
      trigger,
      getSuggestions,
      onChange,
      getEditorState,
      getWrapperRef,
      caseSensitive,
      dropdownClassName,
      optionClassName,
      modalHandler,
    };
  }

  findSuggestionEntities = (contentBlock, callback) => {
    if (this.config.getEditorState()) {
      const { separator, trigger, getSuggestions, getEditorState } =
        this.config;
      const selection = getEditorState().getSelection();
      if (
        selection.get("anchorKey") === contentBlock.get("key") &&
        selection.get("anchorKey") === selection.get("focusKey")
      ) {
        let text = contentBlock.getText();
        text = text.substr(
          0,
          selection.get("focusOffset") === text.length - 1
            ? text.length
            : selection.get("focusOffset") + 1
        );
        let index = text.lastIndexOf(separator + trigger);
        let preText = separator + trigger;
        if ((index === undefined || index < 0) && text[0] === trigger) {
          index = 0;
          preText = trigger;
        }
        if (index >= 0) {
          const mentionText = text.substr(index + preText.length, text.length);
          const suggestionPresent = getSuggestions().some((suggestion) => {
            if (suggestion.value) {
              if (this.config.caseSensitive) {
                return suggestion.value.indexOf(mentionText) >= 0;
              }
              return (
                suggestion.value
                  .toLowerCase()
                  .indexOf(mentionText && mentionText.toLowerCase()) >= 0
              );
            }
            return false;
          });
          if (suggestionPresent) {
            callback(index === 0 ? 0 : index + 1, text.length);
          }
        }
      }
    }
  };

  getSuggestionComponent = getSuggestionComponent.bind(this);

  getSuggestionDecorator = () => ({
    strategy: this.findSuggestionEntities,
    component: this.getSuggestionComponent(),
  });
}

function getSuggestionComponent() {
  const { config } = this;
  return class SuggestionComponent extends Component {
    static propTypes = {
      children: PropTypes.array,
    };

    state = {
      style: { left: 15 },
      activeOption: -1,
      showSuggestions: true,
      filteredSuggestions: [],
    };

    componentDidMount() {
      const editorRect = config.getWrapperRef().getBoundingClientRect();
      const suggestionRect = this.suggestion.getBoundingClientRect();
      const dropdownRect = this.dropdown.getBoundingClientRect();
      let left;
      let right;
      let bottom;
      if (
        editorRect.width <
        suggestionRect.left - editorRect.left + dropdownRect.width
      ) {
        right = 15;
      } else {
        left = 15;
      }
      if (editorRect.bottom < dropdownRect.bottom) {
        bottom = 0;
      }
      this.setState({
        // eslint-disable-line react/no-did-mount-set-state
        style: { left, right, bottom },
      });
      KeyDownHandler.registerCallBack(this.onEditorKeyDown);
      SuggestionHandler.open();
      config.modalHandler.setSuggestionCallback(this.closeSuggestionDropdown);
      this.filterSuggestionsForMount(this.props);
    }

    componentDidUpdate(prevProps) {
      const { children } = this.props;
      if (children !== prevProps.children) {
        this.filterSuggestionsForUpdate(children);
      }
    }

    componentWillUnmount() {
      KeyDownHandler.deregisterCallBack(this.onEditorKeyDown);
      SuggestionHandler.close();
      config.modalHandler.removeSuggestionCallback();
    }

    onEditorKeyDown = (event) => {
      const newState = {};

      if (event.key === "Escape") {
        newState.showSuggestions = false;
        SuggestionHandler.close();
      } else if (event.key === "Enter") {
        this.addMention();
      }
      this.setState((prevState) => ({ ...prevState, ...newState }));
    };

    onOptionMouseEnter = (event) => {
      const index = event.target.getAttribute("data-index");
      this.setState({
        activeOption: index,
      });
    };

    onOptionMouseLeave = () => {
      this.setState({
        activeOption: -1,
      });
    };

    setSuggestionReference = (ref) => {
      this.suggestion = ref;
    };

    setDropdownReference = (ref) => {
      this.dropdown = ref;
    };

    closeSuggestionDropdown = () => {
      this.setState({
        showSuggestions: false,
      });
    };

    filterSuggestions({ suggestions, mentionText }) {
      return (
        suggestions &&
        suggestions.filter((suggestion) => {
          if (!mentionText || mentionText.length === 0) {
            return true;
          }
          if (!suggestion.value) {
            return false;
          }
          if (config.caseSensitive) {
            return suggestion.value.indexOf(mentionText) >= 0;
          }
          return (
            suggestion.value
              .toLowerCase()
              .indexOf(mentionText && mentionText.toLowerCase()) >= 0
          );
        })
      );
    }

    filterSuggestionsForMount(props) {
      const mentionText = props.children[0].props.text.substr(1);
      const suggestions = config.getSuggestions();
      const filteredSuggestions = this.filterSuggestions({
        suggestions,
        mentionText,
      });

      this.setState((prevState) => ({
        ...prevState,
        filteredSuggestions,
      }));
    }

    filterSuggestionsForUpdate(props) {
      const mentionText = props[0].props.text.substr(1);
      const suggestions = config.getSuggestions();
      const filteredSuggestions = this.filterSuggestions({
        suggestions,
        mentionText,
      });

      this.setState((prevState) => ({
        ...prevState,
        showSuggestions: true,
        filteredSuggestions,
      }));
    }

    addMention = () => {
      const { activeOption } = this.state;
      const editorState = config.getEditorState();
      const { onChange, separator, trigger } = config;
      const selectedMention = this.state.filteredSuggestions[activeOption];
      if (selectedMention) {
        addMention(editorState, onChange, separator, trigger, selectedMention);
      }
    };

    render() {
      const { children } = this.props;
      const { activeOption, showSuggestions } = this.state;
      const { dropdownClassName, optionClassName } = config;
      return (
        <span
          className="rdw-suggestion-wrapper"
          ref={this.setSuggestionReference}
          onClick={config.modalHandler.onSuggestionClick}
          aria-haspopup="true"
          aria-label="rdw-suggestion-popup"
        >
          <span>{children}</span>
          {showSuggestions && (
            <span
              className={classNames(
                "rdw-suggestion-dropdown",
                dropdownClassName
              )}
              contentEditable="false"
              suppressContentEditableWarning
              style={this.state.style}
              ref={this.setDropdownReference}
            >
              {this.state.filteredSuggestions.map((suggestion, index) => (
                <span
                  key={index}
                  spellCheck={false}
                  onClick={this.addMention}
                  data-index={index}
                  onMouseEnter={this.onOptionMouseEnter}
                  onMouseLeave={this.onOptionMouseLeave}
                  className={classNames(
                    "rdw-suggestion-option",
                    optionClassName,
                    { "rdw-suggestion-option-active": index === activeOption }
                  )}
                >
                  {suggestion.text}
                </span>
              ))}
            </span>
          )}
        </span>
      );
    }
  };
}

export default Suggestion;
